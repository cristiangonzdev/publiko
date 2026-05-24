import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { notifyUser, notifyAdmin, TG } from '@/lib/telegram'
import { createNotification, notifTitle } from '@/lib/notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
    .select('id, client_id, title, editor_id, bruto_asset_ids, clients!inner(business_name)')
    .eq('id', id)
    .single()
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  const { data: { publicUrl } } = service.storage.from('assets').getPublicUrl(path)

  const { data: asset, error: assetError } = await service
    .from('assets')
    .insert({
      client_id: task.client_id,
      file_name,
      file_type: file_type ?? 'application/octet-stream',
      file_size: file_size ?? null,
      storage_type: 'supabase',
      storage_path: path,
      public_url: publicUrl,
      asset_category: 'bruto',
      uploaded_by: user.id,
    })
    .select('id')
    .single()

  if (assetError || !asset) {
    return NextResponse.json({ error: assetError?.message ?? 'asset insert failed' }, { status: 500 })
  }

  const existingIds = (task.bruto_asset_ids as string[]) ?? []
  const newIds = [...existingIds, asset.id]

  await service
    .from('content_tasks')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({
      bruto_asset_ids: newIds,
      status: 'brutos_ready',
      brutos_uploaded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any)
    .eq('id', id)

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

  return NextResponse.json({ asset_id: asset.id, public_url: publicUrl })
}
