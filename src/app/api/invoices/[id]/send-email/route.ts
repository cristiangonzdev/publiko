import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireInvoiceAccess } from '@/lib/auth/guards'
import { sendClientEmail } from '@/lib/email/notifications'

const BUCKET = 'invoices'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireInvoiceAccess(id)
  if (!auth.ok) return auth.response

  const service = await createServiceClient()

  const { data: invoice } = await service
    .from('invoices')
    .select('id, client_id, invoice_number, amount, status, pdf_url, due_date')
    .eq('id', id)
    .single()
  if (!invoice) return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
  if (!invoice.pdf_url) {
    return NextResponse.json({ error: 'Genera el PDF antes de enviar la factura' }, { status: 409 })
  }

  const [{ data: client }, { data: settings }] = await Promise.all([
    service.from('clients').select('business_name, billing_email, contact_email').eq('id', invoice.client_id).single(),
    service.from('agency_settings').select('agency_name, payment_terms_days, iban').eq('organization_id', auth.ctx.organizationId ?? '00000000-0000-0000-0000-000000000000').maybeSingle(),
  ])
  if (!client) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
  if (!settings) return NextResponse.json({ error: 'agency_settings_missing' }, { status: 409 })

  const to = client.billing_email || client.contact_email
  if (!to) {
    return NextResponse.json(
      { error: 'El cliente no tiene email de facturación ni email de contacto' },
      { status: 400 },
    )
  }

  const { data: pdfBlob, error: downloadError } = await service.storage.from(BUCKET).download(invoice.pdf_url)
  if (downloadError || !pdfBlob) {
    return NextResponse.json({ error: 'No se pudo descargar el PDF de Storage' }, { status: 500 })
  }
  const pdfBase64 = Buffer.from(await pdfBlob.arrayBuffer()).toString('base64')

  const dueText = invoice.due_date
    ? ` antes del <strong>${new Date(invoice.due_date).toLocaleDateString('es-ES')}</strong>`
    : ''
  const result = await sendClientEmail({
    to,
    subject: `Factura ${invoice.invoice_number} — ${settings.agency_name}`,
    template: {
      preheader: `Factura ${invoice.invoice_number} por ${invoice.amount.toLocaleString('es-ES')} €.`,
      title: `Factura ${invoice.invoice_number}`,
      intro: `Hola,<br><br>Te adjuntamos la factura <strong>${invoice.invoice_number}</strong> por un total de <strong>${invoice.amount.toLocaleString('es-ES')} €</strong>.<br><br>Puedes abonarla por transferencia${settings.iban ? ` al IBAN <strong>${settings.iban}</strong>` : ''}${dueText}.`,
      signature: settings.agency_name,
    },
    attachments: [{ filename: `${invoice.invoice_number}.pdf`, content: pdfBase64 }],
  })

  if (result.error) {
    return NextResponse.json({ error: `Error al enviar el email: ${result.error}` }, { status: 502 })
  }

  await service
    .from('invoices')
    .update({
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      // No retroceder estados posteriores (paid/overdue): draft y pending → sent.
      ...(['pending', 'draft'].includes(invoice.status ?? '') ? { status: 'sent' } : {}),
    })
    .eq('id', id)

  return NextResponse.json({ ok: true, to })
}
