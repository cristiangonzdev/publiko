import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { notifyUser } from '@/lib/telegram'
import { createNotification } from '@/lib/notifications'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { note } = await request.json() as { note: string }
  const service = await createServiceClient()

  const { data: task } = await service
    .from('content_tasks')
    .select('editor_id, title, revision_count')
    .eq('id', id)
    .single()

  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await service
    .from('content_tasks')
    .update({
      status: 'revision',
      revision_notes: note,
      revision_count: (task.revision_count ?? 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (task.editor_id) {
    const { data: editor } = await service
      .from('profiles')
      .select('telegram_chat_id')
      .eq('id', task.editor_id)
      .single()

    await notifyUser(
      editor?.telegram_chat_id ?? null,
      `✏️ <b>Revisión solicitada</b>\n\n${task.title}\n\nNota: ${note}`,
    )
    await createNotification(service, {
      userId: task.editor_id,
      type: 'review_rejected',
      title: `Revisión solicitada: ${task.title}`,
      body: note,
      taskId: id,
    })
  }

  return NextResponse.json({ ok: true })
}
