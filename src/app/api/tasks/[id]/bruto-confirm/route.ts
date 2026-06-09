import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireTaskAccess } from '@/lib/auth/guards'
import { createSignedDownloadUrl } from '@/lib/upload/signed-download'
import { notifyUser, notifyAdmin, TG } from '@/lib/telegram'
import { createNotification, notifTitle } from '@/lib/notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isSafeBrutoPath(path: string, clientId: string, taskId: string): boolean {
  // El path debe vivir bajo el prefijo del cliente/tarea y no escapar con ../
  return path.startsWith(`brutos/${clientId}/${taskId}/`) && !path.includes('..')
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const access = await requireTaskAccess(id, { roles: ['grabador'] })
  if (!access.ok) return access.response

  const { path, file_name, file_type, file_size } = await request.json() as {
    path?: string
    file_name?: string
    file_type?: string
    file_size?: number
  }
  if (!path || !file_name) return NextResponse.json({ error: 'path + file_name required' }, { status: 400 })

  const service = await createServiceClient()

  const { data: task } = await service
    .from('content_tasks')
    .select('id, client_id, title, editor_id, clients!inner(business_name)')
    .eq('id', id)
    .single()
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  if (!isSafeBrutoPath(path, task.client_id, id)) {
    return NextResponse.json({ error: 'Ruta de archivo inválida' }, { status: 400 })
  }

  const { data: asset, error: assetError } = await service
    .from('assets')
    .insert({
      client_id: task.client_id,
      file_name,
      file_type: file_type ?? 'application/octet-stream',
      file_size: file_size ?? null,
      storage_type: 'supabase',
      storage_path: path,
      public_url: null,
      asset_category: 'bruto',
      uploaded_by: access.ctx.userId,
    })
    .select('id')
    .single()

  if (assetError || !asset) {
    return NextResponse.json({ error: assetError?.message ?? 'asset insert failed' }, { status: 500 })
  }

  // Append atómico (evita perder ids con subidas en paralelo) + marca brutos_ready
  await service.rpc('append_bruto_asset', { p_task_id: id, p_asset_id: asset.id })
  await service
    .from('content_tasks')
    .update({ status: 'brutos_ready', updated_at: new Date().toISOString() })
    .eq('id', id)

  const signedUrl = await createSignedDownloadUrl(path)
  const businessName = (task.clients as unknown as { business_name: string })?.business_name ?? ''

  if (task.editor_id) {
    const { data: editor } = await service
      .from('profiles')
      .select('telegram_chat_id')
      .eq('id', task.editor_id)
      .single()
    await notifyUser(editor?.telegram_chat_id ?? null, TG.brutosListos(businessName, task.title))
    await createNotification(service, {
      userId: task.editor_id,
      type: 'brutos_ready',
      title: notifTitle('brutos_ready', task.title),
      body: `El grabador ha subido los brutos. Ya puedes empezar la edición.`,
      taskId: task.id,
      clientName: businessName,
    })
  }
  await notifyAdmin(TG.brutosListos(businessName, task.title))

  return NextResponse.json({ asset_id: asset.id, signed_url: signedUrl })
}
