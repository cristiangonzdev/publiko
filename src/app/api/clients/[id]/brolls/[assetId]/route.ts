import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/guards'

export const runtime = 'nodejs'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; assetId: string }> }) {
  const { id, assetId } = await params
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const service = await createServiceClient()

  const { data: asset } = await service
    .from('assets')
    .select('id, storage_path, asset_category, client_id')
    .eq('id', assetId)
    .eq('client_id', id)
    .single()

  if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
  if (asset.asset_category !== 'b_roll') {
    return NextResponse.json({ error: 'Only b-rolls can be deleted via this endpoint' }, { status: 400 })
  }

  await service.storage.from('assets').remove([asset.storage_path])

  await service
    .from('assets')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ deleted_at: new Date().toISOString() } as any)
    .eq('id', assetId)

  return NextResponse.json({ ok: true })
}
