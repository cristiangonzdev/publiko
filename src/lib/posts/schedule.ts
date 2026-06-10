import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Platform } from '@/types/supabase'

type Svc = SupabaseClient<Database>

interface PlatformCopy { copy?: string; hashtags?: string[] }

/**
 * Crea las filas en `posts` (una por plataforma objetivo) a partir de una tarea
 * aprobada con asset final y fecha de publicación. Idempotente: no duplica
 * posts ya existentes para la misma tarea/plataforma. Este paso lo hacía
 * históricamente n8n y nunca se migró al código — sin él nada se publicaba.
 */
export async function schedulePostsForTask(
  service: Svc,
  taskId: string,
): Promise<{ created: number; error?: string }> {
  const { data: task } = await service
    .from('content_tasks')
    .select('id, client_id, target_platforms, copies_per_platform, copy_selected, hashtags, final_asset_id, publish_at')
    .eq('id', taskId)
    .single()

  if (!task) return { created: 0, error: 'Tarea no encontrada' }
  if (!task.final_asset_id) return { created: 0, error: 'La tarea no tiene asset final (entregable)' }
  if (!task.publish_at) return { created: 0, error: 'La tarea no tiene fecha de publicación' }

  const platforms = (task.target_platforms ?? []) as Platform[]
  if (platforms.length === 0) return { created: 0, error: 'La tarea no tiene plataformas objetivo' }

  const perPlatform = (task.copies_per_platform ?? {}) as Record<string, PlatformCopy>

  // Idempotencia: no recrear posts que ya existen para esta tarea
  const { data: existing } = await service.from('posts').select('platform').eq('task_id', taskId)
  const existingPlatforms = new Set((existing ?? []).map((p) => p.platform))

  const rows = platforms
    .filter((p) => !existingPlatforms.has(p))
    .map((platform) => {
      const pc = perPlatform[platform]
      return {
        client_id: task.client_id,
        task_id: task.id,
        platform,
        copy: pc?.copy ?? task.copy_selected ?? '',
        hashtags: pc?.hashtags ?? task.hashtags ?? [],
        asset_id: task.final_asset_id,
        status: 'scheduled',
        scheduled_at: task.publish_at,
      }
    })

  if (rows.length > 0) {
    const { error } = await service.from('posts').insert(rows)
    if (error) return { created: 0, error: error.message }
  }

  await service
    .from('content_tasks')
    .update({ status: 'scheduled', updated_at: new Date().toISOString() })
    .eq('id', taskId)

  return { created: rows.length }
}
