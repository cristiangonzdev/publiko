import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireTaskAccess } from '@/lib/auth/guards'
import { notifyAdmin, TG } from '@/lib/telegram'
import { createNotification, notifTitle } from '@/lib/notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const access = await requireTaskAccess(id, { roles: ['editor'] })
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
    .select('id, client_id, title, clients!inner(business_name)')
    .eq('id', id)
    .single()
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  if (!path.startsWith(`deliverables/${task.client_id}/${id}/`) || path.includes('..')) {
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
      asset_category: 'deliverable',
      uploaded_by: access.ctx.userId,
    })
    .select('id')
    .single()

  if (assetError || !asset) {
    return NextResponse.json({ error: assetError?.message ?? 'asset insert failed' }, { status: 500 })
  }

  await service
    .from('content_tasks')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({
      status: 'delivered',
      final_asset_id: asset.id,
      delivered_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any)
    .eq('id', id)

  const businessName = (task.clients as unknown as { business_name: string })?.business_name ?? ''
  await notifyAdmin(TG.entregadoAdmin(businessName, task.title))

  // Notificar a todos los admin in-app
  const { data: admins } = await service
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
    .eq('is_active', true)

  await Promise.all(
    (admins ?? []).map((admin) =>
      createNotification(service, {
        userId: admin.id,
        type: 'deliverable_sent',
        title: notifTitle('deliverable_sent', task.title),
        body: `El editor ha entregado el contenido. Está listo para revisión.`,
        taskId: task.id,
        clientName: businessName,
      })
    )
  )

  return NextResponse.json({ asset_id: asset.id })
}
