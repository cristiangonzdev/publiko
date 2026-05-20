import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = await createServiceClient()

  const { data: task } = await service
    .from('content_tasks')
    .select('bruto_asset_ids')
    .eq('id', id)
    .single()

  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const ids = (task.bruto_asset_ids as string[]) ?? []
  if (ids.length === 0) return NextResponse.json({ brutos: [] })

  const { data: assets } = await service
    .from('assets')
    .select('id, file_name, public_url, file_size, created_at')
    .in('id', ids)
    .order('created_at', { ascending: true })

  return NextResponse.json({ brutos: assets ?? [] })
}
