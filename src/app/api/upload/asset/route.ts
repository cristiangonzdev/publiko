import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireClientAccess } from '@/lib/auth/guards'

export async function POST(request: NextRequest) {
  const form = await request.formData()
  const file = form.get('file') as File | null
  const clientId = form.get('client_id') as string | null
  const category = (form.get('category') as string | null) ?? 'general'

  if (!file || !clientId) {
    return NextResponse.json({ error: 'file and client_id required' }, { status: 400 })
  }

  const auth = await requireClientAccess(clientId, { adminOnly: true })
  if (!auth.ok) return auth.response

  const service = await createServiceClient()
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `assets/${clientId}/${Date.now()}_${safeName}`

  const { error: uploadError } = await service.storage
    .from('assets')
    .upload(storagePath, buffer, { contentType: file.type, upsert: false })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: asset } = await service
    .from('assets')
    .insert({
      client_id: clientId,
      file_name: file.name,
      file_type: file.type,
      file_size: file.size,
      storage_type: 'supabase',
      storage_path: storagePath,
      public_url: null,
      asset_category: category,
      uploaded_by: auth.ctx.userId,
    })
    .select('id')
    .single()

  return NextResponse.json({ ok: true, asset_id: asset?.id })
}
