import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/guards'
import { createSignedDownloadUrl } from '@/lib/upload/signed-download'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { path, file_name, file_type, file_size, description, tags } = await request.json() as {
    path?: string
    file_name?: string
    file_type?: string
    file_size?: number
    description?: string
    tags?: string[]
  }
  if (!path || !file_name) return NextResponse.json({ error: 'path + file_name required' }, { status: 400 })
  if (!path.startsWith(`brolls/${id}/`) || path.includes('..')) {
    return NextResponse.json({ error: 'Ruta de archivo inválida' }, { status: 400 })
  }

  const service = await createServiceClient()

  const { data: asset, error } = await service
    .from('assets')
    .insert({
      client_id: id,
      file_name,
      file_type: file_type ?? 'application/octet-stream',
      file_size: file_size ?? null,
      storage_type: 'supabase',
      storage_path: path,
      public_url: null,
      asset_category: 'b_roll',
      description: description ?? null,
      tags: tags ?? [],
      uploaded_by: auth.ctx.userId,
    })
    .select('id, file_name, file_type, file_size, storage_path, description, tags, created_at')
    .single()

  if (error || !asset) return NextResponse.json({ error: error?.message ?? 'asset insert failed' }, { status: 500 })

  const signedUrl = await createSignedDownloadUrl(path)
  return NextResponse.json({ asset_id: asset.id, asset: { ...asset, signed_url: signedUrl } })
}
