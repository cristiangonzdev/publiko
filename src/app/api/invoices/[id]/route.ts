import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { computeTotals, normalizeLines } from '@/lib/invoices/totals'
import { requireInvoiceAccess } from '@/lib/auth/guards'
import type { Database, InvoiceLine, Json } from '@/types/supabase'

type InvoiceUpdate = Database['public']['Tables']['invoices']['Update']

const lineSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unit_price: z.number().min(0),
  tax_rate: z.number().min(0).max(100),
})

const patchSchema = z.object({
  lines: z.array(lineSchema).min(1).optional(),
  description: z.string().nullish(),
  notes: z.string().nullish(),
  period_start: z.string().nullish(),
  period_end: z.string().nullish(),
  due_date: z.string().nullish(),
})

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireInvoiceAccess(id)
  if (!auth.ok) return auth.response

  const parsed = patchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.issues }, { status: 400 })
  }
  const body = parsed.data

  const service = await createServiceClient()

  const { data: invoice } = await service
    .from('invoices')
    .select('id, status, sent_at')
    .eq('id', id)
    .single()
  if (!invoice) return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })

  // Solo se editan borradores (pending/draft): una factura enviada o pagada es inmutable.
  if (!['pending', 'draft'].includes(invoice.status ?? '') || invoice.sent_at) {
    return NextResponse.json({ error: 'Solo se pueden editar facturas en borrador (pendientes y no enviadas)' }, { status: 409 })
  }

  const update: InvoiceUpdate = { updated_at: new Date().toISOString() }
  if (body.description !== undefined) update.description = body.description
  if (body.notes !== undefined) update.notes = body.notes
  if (body.period_start !== undefined) update.period_start = body.period_start
  if (body.period_end !== undefined) update.period_end = body.period_end
  if (body.due_date !== undefined) update.due_date = body.due_date

  if (body.lines) {
    const { data: settings } = await service
      .from('agency_settings')
      .select('irpf_rate')
      .eq('organization_id', auth.ctx.organizationId ?? '00000000-0000-0000-0000-000000000000')
      .maybeSingle()
    if (!settings) return NextResponse.json({ error: 'agency_settings_missing' }, { status: 409 })

    const lines = normalizeLines(body.lines.map((l) => ({ ...l, subtotal: 0 })) as InvoiceLine[])
    if (!lines.length) return NextResponse.json({ error: 'La factura no tiene líneas válidas' }, { status: 400 })
    const totals = computeTotals(lines, settings.irpf_rate)

    update.lines = lines as unknown as Json
    update.subtotal = totals.subtotal
    update.tax_amount = totals.tax_amount
    update.irpf_amount = totals.irpf_amount
    update.amount = Math.round(totals.total)
    // El PDF anterior queda obsoleto al cambiar las líneas.
    update.pdf_url = null
  }

  const { data: updated, error } = await service
    .from('invoices')
    .update(update)
    .eq('id', id)
    .select('*')
    .single()

  if (error || !updated) {
    return NextResponse.json({ error: error?.message ?? 'Error al actualizar' }, { status: 500 })
  }
  return NextResponse.json({ invoice: updated })
}
