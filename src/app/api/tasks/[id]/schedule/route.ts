import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireTaskAccess } from '@/lib/auth/guards'
import { schedulePostsForTask } from '@/lib/posts/schedule'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Programa una tarea aprobada: fija publish_at y crea las filas en `posts`
 * (una por plataforma). A partir de aquí el cron publish-retry las publica.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireTaskAccess(id, { roles: [] })
  if (!auth.ok) return auth.response
  const { publish_at } = await request.json() as { publish_at?: string }
  if (!publish_at) return NextResponse.json({ error: 'publish_at requerido' }, { status: 400 })

  const ts = Date.parse(publish_at)
  if (isNaN(ts)) return NextResponse.json({ error: 'publish_at inválido' }, { status: 400 })

  const service = await createServiceClient()

  // La tarea debe estar aprobada (con entregable) antes de programarse.
  const { data: task } = await service
    .from('content_tasks')
    .select('status')
    .eq('id', id)
    .single()
  if (!task) return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 })
  if (!['approved', 'scheduled'].includes(task.status)) {
    return NextResponse.json({ error: 'La tarea debe estar aprobada para programarse' }, { status: 409 })
  }

  await service
    .from('content_tasks')
    .update({ publish_at: new Date(ts).toISOString(), approved_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id)

  const result = await schedulePostsForTask(service, id)
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })

  return NextResponse.json({ ok: true, posts_created: result.created })
}
