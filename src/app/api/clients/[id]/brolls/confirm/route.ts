import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { path, file_name, file_type, file_size, description, tags } = await request.json() as {
    path?: string
    file_name?: string
    file_type?: string
    file_size?: number
    description?: string
    tags?: string[]
  }
  if (!path || !file_name) return NextResponse.json({ error: 'path + file_name required' }, { status: 400 })

  const service = await createServiceClient()
  const { data: { publicUrl } } = service.storage.from('assets').getPublicUrl(path)

  const { data: asset, error } = await service
    .from('assets')
    .insert({
      client_id: id,
      file_name,
      file_type: file_type ?? 'application/octet-stream',
      file_size: file_size ?? null,
      storage_type: 'supabase',
      storage_path: path,
      public_url: publicUrl,
      asset_category: 'b_roll',
      description: description ?? null,
      tags: tags ?? [],
      uploaded_by: user.id,
    })
    .select('id, file_name, file_type, file_size, public_url, storage_path, description, tags, created_at')
    .single()

  if (error || !asset) return NextResponse.json({ error: error?.message ?? 'asset insert failed' }, { status: 500 })

  return NextResponse.json({ asset_id: asset.id, public_url: publicUrl, asset })
}
