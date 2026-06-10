import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireClientAccess } from '@/lib/auth/guards'
import { createSignedDownloadUrls } from '@/lib/upload/signed-download'

export const runtime = 'nodejs'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const access = await requireClientAccess(id)
  if (!access.ok) return access.response

  const service = await createServiceClient()
  const { data: brolls } = await service
    .from('assets')
    .select('id, file_name, file_type, file_size, storage_path, description, tags, created_at')
    .eq('client_id', id)
    .eq('asset_category', 'b_roll')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  const signed = await createSignedDownloadUrls((brolls ?? []).map((b) => b.storage_path))
  const withUrls = (brolls ?? []).map((b) => ({ ...b, signed_url: signed.get(b.storage_path) ?? null }))

  return NextResponse.json({ brolls: withUrls })
}
