import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const service = await createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: revision } = await (service as any)
    .from('brand_brain_revisions')
    .select('id')
    .eq('id', id)
    .eq('status', 'pending')
    .single()

  if (!revision) return NextResponse.json({ error: 'Revision not found or already reviewed' }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (service as any)
    .from('brand_brain_revisions')
    .update({ status: 'rejected', reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq('id', id)

  return NextResponse.json({ ok: true })
}
