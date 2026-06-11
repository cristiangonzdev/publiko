import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireClientAccess } from '@/lib/auth/guards'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireClientAccess(id, { adminOnly: true })
  if (!auth.ok) return auth.response

  const supabase = await createClient()

  const { status } = await request.json() as { status: string }
  if (!status) return NextResponse.json({ error: 'status required' }, { status: 400 })

  const { error } = await supabase
    .from('clients')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ status: status as any, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
