import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/guards'
import { computeTotals } from '@/lib/invoices/totals'
import type { InvoiceLine, Json } from '@/types/supabase'

export async function POST() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const orgId = auth.ctx.organizationId
  if (!orgId) {
    return NextResponse.json({ error: 'Tu usuario no tiene organización asignada' }, { status: 409 })
  }

  const service = await createServiceClient()

  const { data: settings } = await service
    .from('agency_settings')
    .select('igic_rate, irpf_rate')
    .eq('organization_id', orgId)
    .maybeSingle()
  if (!settings) {
    return NextResponse.json({ error: 'Configura los datos de la agencia antes de facturar' }, { status: 409 })
  }

  const { data: clients } = await service
    .from('clients')
    .select('id, business_name, monthly_fee, billing_day')
    .eq('organization_id', orgId)
    .eq('status', 'active')
    .eq('is_active', true)

  if (!clients?.length) return NextResponse.json({ created: 0 })

  const now = new Date()
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const periodStart = `${yearMonth}-01`

  let created = 0
  for (const client of clients) {
    // Dedupe por periodo (el invoice_number ya no es determinista por cliente):
    // una factura monthly por cliente y mes.
    const { data: existing } = await service
      .from('invoices')
      .select('id')
      .eq('client_id', client.id)
      .eq('invoice_type', 'monthly')
      .eq('period_start', periodStart)
      .maybeSingle()

    if (existing) continue

    const { data: invoiceNumber, error: numberError } = await service.rpc('next_invoice_number', { p_org: orgId })
    if (numberError || !invoiceNumber) {
      return NextResponse.json(
        { error: 'No se pudo generar el número de factura — revisa los datos de la agencia', created },
        { status: 500 },
      )
    }

    const billingDay = client.billing_day ?? 1
    const dueDate = new Date(now.getFullYear(), now.getMonth(), billingDay)
    if (dueDate < now) dueDate.setMonth(dueDate.getMonth() + 1)

    const lines: InvoiceLine[] = [{
      description: `Servicio de gestión de redes sociales — ${yearMonth}`,
      quantity: 1,
      unit_price: client.monthly_fee ?? 0,
      tax_rate: settings.igic_rate,
      subtotal: client.monthly_fee ?? 0,
    }]
    const totals = computeTotals(lines, settings.irpf_rate)

    await service.from('invoices').insert({
      client_id: client.id,
      organization_id: orgId,
      invoice_number: invoiceNumber,
      lines: lines as unknown as Json,
      subtotal: totals.subtotal,
      tax_amount: totals.tax_amount,
      irpf_amount: totals.irpf_amount,
      amount: Math.round(totals.total),
      invoice_type: 'monthly',
      description: `Servicio de gestión de redes sociales — ${yearMonth}`,
      period_start: periodStart,
      period_end: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10),
      status: 'pending',
      due_date: dueDate.toISOString().slice(0, 10),
      created_by: auth.ctx.userId,
    })

    created++
  }

  return NextResponse.json({ created })
}
