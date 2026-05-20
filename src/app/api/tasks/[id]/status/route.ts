import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { status: string; publish_at?: string }
  if (!body.status) return NextResponse.json({ error: 'status required' }, { status: 400 })

  const updates: Record<string, string> = {
    status: body.status,
    updated_at: new Date().toISOString(),
  }
  if (body.status === 'editing') updates.editing_started_at = new Date().toISOString()
  if (body.status === 'approved') updates.approved_at = new Date().toISOString()
  if (body.publish_at) updates.publish_at = body.publish_at

  const { error } = await supabase
    .from('content_tasks')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(updates as any)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
