import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/guards'

export const runtime = 'nodejs'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { id } = await params

  const { tier } = await request.json() as { tier?: string }
  if (tier !== 'auto' && tier !== 'manual') {
    return NextResponse.json({ error: 'tier must be auto or manual' }, { status: 400 })
  }

  const service = await createServiceClient()
  const { error } = await service
    .from('content_tasks')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ approval_tier: tier, updated_at: new Date().toISOString() } as any)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, tier })
}
