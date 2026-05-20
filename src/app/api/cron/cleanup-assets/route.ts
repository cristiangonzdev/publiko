import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// Called by Vercel cron (vercel.json) or n8n daily
// Deletes storage files for tasks published more than 14 days ago
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = await createServiceClient()
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

  const { data: tasks } = await service
    .from('content_tasks')
    .select('id, bruto_asset_ids, final_asset_id')
    .eq('status', 'published')
    .lt('published_at', cutoff)
    .or('final_asset_id.not.is.null,bruto_asset_ids.neq.{}')

  if (!tasks?.length) return NextResponse.json({ cleaned: 0 })

  let cleaned = 0

  for (const task of tasks) {
    const assetIds = [
      ...((task.bruto_asset_ids as string[]) ?? []),
      ...(task.final_asset_id ? [task.final_asset_id] : []),
    ]

    if (assetIds.length === 0) continue

    const { data: assets } = await service
      .from('assets')
      .select('id, storage_path')
      .in('id', assetIds)

    for (const asset of assets ?? []) {
      await service.storage.from('assets').remove([asset.storage_path])
      await service.from('assets').delete().eq('id', asset.id)
    }

    await service
      .from('content_tasks')
      .update({ bruto_asset_ids: [], final_asset_id: null, updated_at: new Date().toISOString() })
      .eq('id', task.id)

    cleaned++
  }

  return NextResponse.json({ cleaned, tasks_processed: tasks.length })
}
