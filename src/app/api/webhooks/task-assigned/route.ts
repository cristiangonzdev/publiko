import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { notifyUser, TG } from '@/lib/telegram'

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-webhook-secret')
  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { task_id } = await request.json() as { task_id: string }
  const supabase = await createServiceClient()

  const { data: task } = await supabase
    .from('content_tasks')
    .select('id, title, deadline, grabador_id, editor_id, client_id')
    .eq('id', task_id)
    .single()

  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  const { data: client } = await supabase
    .from('clients')
    .select('business_name')
    .eq('id', task.client_id)
    .single()

  const businessName = client?.business_name ?? ''

  if (task.grabador_id) {
    const { data: grabador } = await supabase
      .from('profiles')
      .select('telegram_chat_id')
      .eq('id', task.grabador_id)
      .single()

    await notifyUser(
      grabador?.telegram_chat_id ?? null,
      TG.brutosPendientes(businessName, task.title, task.deadline),
    )
  }

  return NextResponse.json({ ok: true })
}
