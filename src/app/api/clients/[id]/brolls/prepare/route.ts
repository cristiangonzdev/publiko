import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/guards'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { file_name } = await request.json() as { file_name?: string }
  if (!file_name) return NextResponse.json({ error: 'file_name required' }, { status: 400 })

  const service = await createServiceClient()
  const safeName = file_name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `brolls/${id}/${Date.now()}_${safeName}`

  const { data, error } = await service.storage
    .from('assets')
    .createSignedUploadUrl(path)

  if (error || !data) return NextResponse.json({ error: error?.message ?? 'sign failed' }, { status: 500 })

  return NextResponse.json({ bucket: 'assets', path: data.path, token: data.token })
}
