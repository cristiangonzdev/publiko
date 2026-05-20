import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { notifyUser, TG } from '@/lib/telegram'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { grabador_id, editor_id, deadline, target_platforms, publish_at } = await request.json() as {
    grabador_id?: string
    editor_id?: string
    deadline?: string
    target_platforms?: string[]
    publish_at?: string
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (grabador_id !== undefined) updates.grabador_id = grabador_id || null
  if (editor_id !== undefined) updates.editor_id = editor_id || null
  if (deadline) updates.deadline = deadline
  if (target_platforms) updates.target_platforms = target_platforms
  if (publish_at) updates.publish_at = publish_at

  const service = await createServiceClient()

  const { data: task } = await service
    .from('content_tasks')
    .select('title, client_id, clients!inner(business_name)')
    .eq('id', id)
    .single()

  await service
    .from('content_tasks')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(updates as any)
    .eq('id', id)

  if (task && grabador_id) {
    const { data: grabador } = await service
      .from('profiles')
      .select('telegram_chat_id')
      .eq('id', grabador_id)
      .single()

    const businessName = (task.clients as unknown as { business_name: string })?.business_name ?? ''
    await notifyUser(
      grabador?.telegram_chat_id ?? null,
      TG.brutosPendientes(businessName, task.title, deadline ?? null),
    )
  }

  return NextResponse.json({ ok: true })
}
