import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/guards'
import { createSignedDownloadUrl } from '@/lib/upload/signed-download'
import { isEvolutionConfigured, sendDocument } from '@/lib/whatsapp/evolution'

const BUCKET = 'invoices'
// Evolution descarga el documento de forma asíncrona y el cliente puede
// reabrirlo desde el chat: TTL largo (7 días).
const WHATSAPP_TTL_SECONDS = 7 * 24 * 3600

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  if (!isEvolutionConfigured()) {
    return NextResponse.json(
      { error: 'WhatsApp no configurado: faltan EVOLUTION_API_URL, EVOLUTION_API_KEY o EVOLUTION_INSTANCE' },
      { status: 503 },
    )
  }

  const { id } = await params
  const service = await createServiceClient()

  const { data: invoice } = await service
    .from('invoices')
    .select('id, client_id, invoice_number, amount, status, pdf_url')
    .eq('id', id)
    .single()
  if (!invoice) return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
  if (!invoice.pdf_url) {
    return NextResponse.json({ error: 'Genera el PDF antes de enviar la factura' }, { status: 409 })
  }

  const [{ data: client }, { data: settings }] = await Promise.all([
    service.from('clients').select('business_name, contact_whatsapp, contact_phone').eq('id', invoice.client_id).single(),
    service.from('agency_settings').select('agency_name').limit(1).maybeSingle(),
  ])
  if (!client) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

  const phone = client.contact_whatsapp || client.contact_phone
  if (!phone) {
    return NextResponse.json({ error: 'El cliente no tiene WhatsApp ni teléfono de contacto' }, { status: 400 })
  }

  const url = await createSignedDownloadUrl(invoice.pdf_url, WHATSAPP_TTL_SECONDS, BUCKET)
  if (!url) return NextResponse.json({ error: 'No se pudo firmar la URL del PDF' }, { status: 500 })

  const caption = `Factura ${invoice.invoice_number} — ${settings?.agency_name ?? 'Publiko'} · ${invoice.amount.toLocaleString('es-ES')} €`
  const result = await sendDocument(phone, url, caption, `${invoice.invoice_number}.pdf`)
  if (!result.ok) {
    return NextResponse.json({ error: `Error al enviar por WhatsApp: ${result.error}` }, { status: 502 })
  }

  await service
    .from('invoices')
    .update({
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...(invoice.status === 'pending' ? { status: 'sent' } : {}),
    })
    .eq('id', id)

  return NextResponse.json({ ok: true, phone })
}
