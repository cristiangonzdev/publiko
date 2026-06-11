import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/guards'
import { createSignedDownloadUrl } from '@/lib/upload/signed-download'

const BUCKET = 'invoices'
const MAX_PDF_BYTES = 2 * 1024 * 1024 // los PDFs de factura rondan los 50-200 KB

/**
 * POST: recibe el PDF generado en el browser (FormData, campo 'file') y lo
 * sube al bucket privado 'invoices'. pdf_url guarda el PATH de Storage,
 * nunca una URL (regla de seguridad nº2: signed URLs bajo demanda).
 * Tamaño muy por debajo del límite de 4.5MB de Vercel: no necesita el
 * flujo prepare/confirm de los assets.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { id } = await params
  const service = await createServiceClient()

  const { data: invoice } = await service
    .from('invoices')
    .select('id, invoice_number')
    .eq('id', id)
    .single()
  if (!invoice) return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })

  const form = await request.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: 'Falta el archivo PDF (campo "file")' }, { status: 400 })
  }
  if (file.size === 0 || file.size > MAX_PDF_BYTES) {
    return NextResponse.json({ error: 'Tamaño de PDF inválido' }, { status: 400 })
  }

  const path = `${invoice.id}/${invoice.invoice_number}.pdf`
  const { error: uploadError } = await service.storage
    .from(BUCKET)
    .upload(path, file, { contentType: 'application/pdf', upsert: true })
  if (uploadError) {
    return NextResponse.json({ error: `Error al subir el PDF: ${uploadError.message}` }, { status: 500 })
  }

  const { error: updateError } = await service
    .from('invoices')
    .update({ pdf_url: path, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, path })
}

/** GET: devuelve una signed URL temporal (1h) para visualizar el PDF. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { id } = await params
  const service = await createServiceClient()

  const { data: invoice } = await service
    .from('invoices')
    .select('id, pdf_url')
    .eq('id', id)
    .single()
  if (!invoice) return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
  if (!invoice.pdf_url) return NextResponse.json({ error: 'La factura no tiene PDF generado' }, { status: 404 })

  const url = await createSignedDownloadUrl(invoice.pdf_url, 3600, BUCKET)
  if (!url) return NextResponse.json({ error: 'No se pudo firmar la URL del PDF' }, { status: 500 })

  return NextResponse.json({ url })
}
