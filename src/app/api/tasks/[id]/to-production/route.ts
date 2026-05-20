import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { notifyUser, notifyAdmin, TG } from '@/lib/telegram'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = await createServiceClient()

  const { data: task } = await service
    .from('content_tasks')
    .select('id, idea_id, client_id, title, grabador_id, copy_selected, deadline, clients!inner(business_name)')
    .eq('id', id)
    .single()

  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  if (!task.copy_selected) {
    return NextResponse.json({ error: 'Select a copy before sending to production' }, { status: 400 })
  }

  const now = new Date().toISOString()

  const { error: taskErr } = await service
    .from('content_tasks')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({
      status: 'recording',
      recording_started_at: now,
      updated_at: now,
    } as any)
    .eq('id', id)

  if (taskErr) return NextResponse.json({ error: taskErr.message }, { status: 500 })

  if (task.idea_id) {
    await service
      .from('content_ideas')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ status: 'in_production' } as any)
      .eq('id', task.idea_id)
  }

  const businessName = (task.clients as unknown as { business_name: string })?.business_name ?? ''
  const message = TG.brutosPendientes(businessName, task.title, task.deadline ?? null)

  if (task.grabador_id) {
    const { data: grabador } = await service
      .from('profiles')
      .select('telegram_chat_id')
      .eq('id', task.grabador_id)
      .single()
    await notifyUser(grabador?.telegram_chat_id ?? null, message)
  } else {
    await notifyAdmin(message)
  }

  return NextResponse.json({ ok: true })
}
