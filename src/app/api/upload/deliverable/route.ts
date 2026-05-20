import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { notifyAdmin, TG } from '@/lib/telegram'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await request.formData()
  const file = form.get('file') as File | null
  const taskId = form.get('task_id') as string | null

  if (!file || !taskId) {
    return NextResponse.json({ error: 'file and task_id required' }, { status: 400 })
  }

  const service = await createServiceClient()

  const { data: task } = await service
    .from('content_tasks')
    .select('id, client_id, title, clients!inner(business_name)')
    .eq('id', taskId)
    .single()

  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const ext = file.name.split('.').pop() ?? 'mp4'
  const storagePath = `deliverables/${task.client_id}/${taskId}/final.${ext}`

  const { error: uploadError } = await service.storage
    .from('assets')
    .upload(storagePath, buffer, { contentType: file.type, upsert: true })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: { publicUrl } } = service.storage.from('assets').getPublicUrl(storagePath)

  const { data: asset } = await service
    .from('assets')
    .insert({
      client_id: task.client_id,
      file_name: file.name,
      file_type: file.type,
      file_size: file.size,
      storage_type: 'supabase',
      storage_path: storagePath,
      public_url: publicUrl,
      asset_category: 'deliverable',
      uploaded_by: user.id,
    })
    .select('id')
    .single()

  await service
    .from('content_tasks')
    .update({
      status: 'delivered',
      final_asset_id: asset?.id ?? null,
      delivered_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId)

  const businessName = (task.clients as unknown as { business_name: string })?.business_name ?? ''
  await notifyAdmin(TG.entregadoAdmin(businessName, task.title))

  return NextResponse.json({ ok: true, asset_id: asset?.id, public_url: publicUrl })
}
