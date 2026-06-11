import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { requireAdmin, orgMismatch } from '@/lib/auth/guards'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { id } = await params

  // El aislamiento entre orgs depende de este check: la idea debe ser de la org del admin.
  const service = await createServiceClient()
  const { data: idea } = await service
    .from('content_ideas')
    .select('client_id')
    .eq('id', id)
    .single()
  if (!idea) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: ownerClient } = await service
    .from('clients')
    .select('organization_id')
    .eq('id', idea.client_id)
    .single()
  if (!ownerClient || orgMismatch(auth.ctx, ownerClient.organization_id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('content_ideas')
    .update({
      status: 'discarded',
      can_recycle_after: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
