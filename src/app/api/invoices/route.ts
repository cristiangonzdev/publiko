import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/guards'
import { computeTotals, normalizeLines } from '@/lib/invoices/totals'
import type { InvoiceLine, Json } from '@/types/supabase'

const lineSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unit_price: z.number().min(0),
  tax_rate: z.number().min(0).max(100),
})

const createSchema = z.object({
  client_id: z.string().uuid(),
  lines: z.array(lineSchema).min(1),
  invoice_type: z.enum(['setup', 'monthly', 'extra']).default('extra'),
  description: z.string().nullish(),
  notes: z.string().nullish(),
  period_start: z.string().nullish(),
  period_end: z.string().nullish(),
  due_date: z.string().nullish(),
})

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const parsed = createSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos de factura inválidos', details: parsed.error.issues }, { status: 400 })
  }
  const body = parsed.data

  const service = await createServiceClient()

  const { data: settings } = await service
    .from('agency_settings')
    .select('id, agency_name, irpf_rate, payment_terms_days')
    .limit(1)
    .maybeSingle()
  if (!settings) {
    return NextResponse.json({ error: 'agency_settings_missing' }, { status: 409 })
  }

  const { data: client } = await service
    .from('clients')
    .select('id, business_name')
    .eq('id', body.client_id)
    .is('deleted_at', null)
    .single()
  if (!client) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

  // Totales SIEMPRE recalculados server-side: del cliente solo se aceptan las líneas.
  const lines = normalizeLines(body.lines.map((l) => ({ ...l, subtotal: 0 })) as InvoiceLine[])
  if (!lines.length) return NextResponse.json({ error: 'La factura no tiene líneas válidas' }, { status: 400 })
  const totals = computeTotals(lines, settings.irpf_rate)

  const { data: invoiceNumber, error: numberError } = await service.rpc('next_invoice_number')
  if (numberError || !invoiceNumber) {
    const missing = numberError?.message?.includes('agency_settings_missing')
    return NextResponse.json(
      { error: missing ? 'agency_settings_missing' : 'No se pudo generar el número de factura' },
      { status: missing ? 409 : 500 },
    )
  }

  const dueDate = body.due_date
    ?? new Date(Date.now() + settings.payment_terms_days * 86400000).toISOString().slice(0, 10)

  const { data: invoice, error } = await service
    .from('invoices')
    .insert({
      client_id: body.client_id,
      invoice_number: invoiceNumber,
      invoice_type: body.invoice_type,
      description: body.description ?? null,
      lines: lines as unknown as Json,
      subtotal: totals.subtotal,
      tax_amount: totals.tax_amount,
      irpf_amount: totals.irpf_amount,
      // amount (integer, euros) se mantiene sincronizado con el total para
      // no romper KPIs ni flujos existentes que leen amount.
      amount: Math.round(totals.total),
      notes: body.notes ?? null,
      period_start: body.period_start ?? null,
      period_end: body.period_end ?? null,
      due_date: dueDate,
      status: 'pending',
      created_by: auth.ctx.userId,
    })
    .select('*')
    .single()

  if (error || !invoice) {
    return NextResponse.json({ error: error?.message ?? 'Error al crear la factura' }, { status: 500 })
  }
  return NextResponse.json({ invoice, totals })
}
