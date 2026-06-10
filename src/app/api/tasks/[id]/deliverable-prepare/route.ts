import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireTaskAccess } from '@/lib/auth/guards'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const access = await requireTaskAccess(id, { roles: ['editor'] })
  if (!access.ok) return access.response

  const { file_name } = await request.json() as { file_name?: string }
  if (!file_name) return NextResponse.json({ error: 'file_name required' }, { status: 400 })

  const service = await createServiceClient()
  const { data: task } = await service
    .from('content_tasks')
    .select('id, client_id')
    .eq('id', id)
    .single()
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  const safeName = file_name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `deliverables/${task.client_id}/${id}/${Date.now()}_${safeName}`

  const { data, error } = await service.storage
    .from('assets')
    .createSignedUploadUrl(path)

  if (error || !data) return NextResponse.json({ error: error?.message ?? 'sign failed' }, { status: 500 })

  return NextResponse.json({ bucket: 'assets', path: data.path, token: data.token })
}
