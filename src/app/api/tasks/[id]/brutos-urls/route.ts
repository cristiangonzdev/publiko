import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireTaskAccess } from '@/lib/auth/guards'
import { createSignedDownloadUrls } from '@/lib/upload/signed-download'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const access = await requireTaskAccess(id, { roles: ['editor', 'grabador'] })
  if (!access.ok) return access.response

  const service = await createServiceClient()

  const { data: task } = await service
    .from('content_tasks')
    .select('bruto_asset_ids')
    .eq('id', id)
    .single()

  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const ids = (task.bruto_asset_ids as string[]) ?? []
  if (ids.length === 0) return NextResponse.json({ brutos: [] })

  const { data: assets } = await service
    .from('assets')
    .select('id, file_name, storage_path, file_size, created_at')
    .in('id', ids)
    .order('created_at', { ascending: true })

  const signed = await createSignedDownloadUrls((assets ?? []).map((a) => a.storage_path))
  const brutos = (assets ?? []).map((a) => ({
    id: a.id,
    file_name: a.file_name,
    file_size: a.file_size,
    created_at: a.created_at,
    signed_url: signed.get(a.storage_path) ?? null,
  }))

  return NextResponse.json({ brutos })
}
