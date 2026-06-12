import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireTaskAccess } from '@/lib/auth/guards'
import { notifyUser, notifyAdmin, TG } from '@/lib/telegram'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const access = await requireTaskAccess(id, { roles: ['grabador'] })
  if (!access.ok) return access.response

  const form = await request.formData()
  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'file required' }, { status: 400 })

  const service = await createServiceClient()

  const { data: task } = await service
    .from('content_tasks')
    .select('id, client_id, title, editor_id, clients!inner(business_name)')
    .eq('id', id)
    .single()

  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const ext = (file.name.split('.').pop() ?? 'mp4').replace(/[^a-zA-Z0-9]/g, '')
  const timestamp = Date.now()
  const storagePath = `brutos/${task.client_id}/${id}/${timestamp}.${ext}`

  const { error: uploadError } = await service.storage
    .from('assets')
    .upload(storagePath, buffer, { contentType: file.type, upsert: false })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: asset } = await service
    .from('assets')
    .insert({
      client_id: task.client_id,
      file_name: file.name,
      file_type: file.type,
      file_size: file.size,
      storage_type: 'supabase',
      storage_path: storagePath,
      public_url: null,
      asset_category: 'bruto',
      uploaded_by: access.ctx.userId,
    })
    .select('id')
    .single()

  if (asset?.id) {
    await service.rpc('append_bruto_asset', { p_task_id: id, p_asset_id: asset.id })
  }
  // Solo avanza a brutos_ready desde fases de grabación: si la tarea ya está
  // en edición/entregada, añadir otro bruto no debe regresar su estado.
  await service
    .from('content_tasks')
    .update({ status: 'brutos_ready', updated_at: new Date().toISOString() })
    .eq('id', id)
    .in('status', ['brief_sent', 'recording', 'brutos_ready'])

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

  return NextResponse.json({ ok: true, asset_id: asset?.id })
}
