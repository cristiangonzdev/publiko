import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await request.formData()
  const file = form.get('file') as File | null
  const clientId = form.get('client_id') as string | null
  const category = (form.get('category') as string | null) ?? 'general'

  if (!file || !clientId) {
    return NextResponse.json({ error: 'file and client_id required' }, { status: 400 })
  }

  const service = await createServiceClient()
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const ext = file.name.split('.').pop() ?? 'bin'
  const storagePath = `assets/${clientId}/${Date.now()}_${file.name.replace(/\s/g, '_')}.${ext}`

  const { error: uploadError } = await service.storage
    .from('assets')
    .upload(storagePath, buffer, { contentType: file.type, upsert: false })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: { publicUrl } } = service.storage.from('assets').getPublicUrl(storagePath)

  const { data: asset } = await service
    .from('assets')
    .insert({
      client_id: clientId,
      file_name: file.name,
      file_type: file.type,
      file_size: file.size,
      storage_type: 'supabase',
      storage_path: storagePath,
      public_url: publicUrl,
      asset_category: category,
      uploaded_by: user.id,
    })
    .select('id')
    .single()

  return NextResponse.json({ ok: true, asset_id: asset?.id, public_url: publicUrl })
}
