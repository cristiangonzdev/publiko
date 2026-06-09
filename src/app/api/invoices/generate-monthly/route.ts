import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/guards'

export async function POST() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const service = await createServiceClient()

  const { data: clients } = await service
    .from('clients')
    .select('id, business_name, monthly_fee, billing_day')
    .eq('status', 'active')
    .eq('is_active', true)

  if (!clients?.length) return NextResponse.json({ created: 0 })

  const now = new Date()
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  let created = 0
  for (const client of clients) {
    const invoiceNumber = `INV-${yearMonth}-${client.id.slice(0, 6).toUpperCase()}`

    const { data: existing } = await service
      .from('invoices')
      .select('id')
      .eq('client_id', client.id)
      .eq('invoice_number', invoiceNumber)
      .single()

    if (existing) continue

    const billingDay = client.billing_day ?? 1
    const dueDate = new Date(now.getFullYear(), now.getMonth(), billingDay)
    if (dueDate < now) dueDate.setMonth(dueDate.getMonth() + 1)

    await service.from('invoices').insert({
      client_id: client.id,
      invoice_number: invoiceNumber,
      amount: client.monthly_fee ?? 0,
      invoice_type: 'monthly',
      description: `Servicio de gestión de redes sociales — ${yearMonth}`,
      period_start: `${yearMonth}-01`,
      period_end: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10),
      status: 'pending',
      due_date: dueDate.toISOString().slice(0, 10),
    })

    created++
  }

  return NextResponse.json({ created })
}
