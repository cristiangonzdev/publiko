import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const maxDuration = 300

// Called by Vercel cron (vercel.json) or n8n daily
// Deletes storage files for tasks published more than 14 days ago
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = await createServiceClient()
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

  const { data: tasks, error: tasksErr } = await service
    .from('content_tasks')
    .select('id, bruto_asset_ids, final_asset_id')
    .eq('status', 'published')
    .lt('published_at', cutoff)
    .or('final_asset_id.not.is.null,bruto_asset_ids.neq.{}')
    .limit(200)

  if (tasksErr) {
    return NextResponse.json({ error: tasksErr.message }, { status: 500 })
  }
  if (!tasks?.length) return NextResponse.json({ cleaned: 0 })

  let cleaned = 0
  let skipped = 0
  const errors: string[] = []

  for (const task of tasks) {
    const assetIds = [
      ...((task.bruto_asset_ids as string[]) ?? []),
      ...(task.final_asset_id ? [task.final_asset_id] : []),
    ]

    if (assetIds.length === 0) continue

    // No borrar media si la tarea aún tiene posts pendientes de publicar/reintentar.
    const { data: pendingPosts, error: postsErr } = await service
      .from('posts')
      .select('id')
      .eq('task_id', task.id)
      .in('status', ['scheduled', 'publishing'])
      .limit(1)

    if (postsErr) {
      errors.push(`task ${task.id}: check posts: ${postsErr.message}`)
      continue
    }
    if (pendingPosts && pendingPosts.length > 0) {
      skipped++
      continue
    }

    const { data: assets, error: assetsErr } = await service
      .from('assets')
      .select('id, storage_path')
      .in('id', assetIds)

    if (assetsErr) {
      errors.push(`task ${task.id}: load assets: ${assetsErr.message}`)
      continue
    }

    let taskFailed = false
    for (const asset of assets ?? []) {
      const { error: rmErr } = await service.storage.from('assets').remove([asset.storage_path])
      if (rmErr) {
        errors.push(`asset ${asset.id}: storage remove: ${rmErr.message}`)
        taskFailed = true
        continue
      }
      const { error: delErr } = await service.from('assets').delete().eq('id', asset.id)
      if (delErr) {
        errors.push(`asset ${asset.id}: row delete: ${delErr.message}`)
        taskFailed = true
      }
    }

    // Solo limpiar las referencias de la tarea si el media se borró sin errores,
    // para no perder los ids de assets que no se llegaron a eliminar.
    if (taskFailed) continue

    const { error: clearErr } = await service
      .from('content_tasks')
      .update({ bruto_asset_ids: [], final_asset_id: null, updated_at: new Date().toISOString() })
      .eq('id', task.id)

    if (clearErr) {
      errors.push(`task ${task.id}: clear refs: ${clearErr.message}`)
      continue
    }

    cleaned++
  }

  return NextResponse.json({ cleaned, skipped, tasks_processed: tasks.length, errors })
}
