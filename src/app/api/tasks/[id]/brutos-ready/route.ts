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
    .select('id, client_id, title, editor_id, clients!inner(business_name)')
    .eq('id', id)
    .single()

  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  await service
    .from('content_tasks')
    .update({
      status: 'brutos_ready',
      brutos_uploaded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  const businessName = (task.clients as unknown as { business_name: string })?.business_name ?? ''

  if (task.editor_id) {
    const { data: editor } = await service
      .from('profiles')
      .select('telegram_chat_id')
      .eq('id', task.editor_id)
      .single()

    await notifyUser(editor?.telegram_chat_id ?? null, TG.brutosListos(businessName, task.title))
  }

  await notifyAdmin(TG.brutosListos(businessName, task.title))

  return NextResponse.json({ ok: true })
}
