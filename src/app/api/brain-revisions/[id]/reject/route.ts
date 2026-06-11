import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getAuthContext, orgMismatch } from '@/lib/auth/guards'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (ctx.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const service = await createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: revision } = await (service as any)
    .from('brand_brain_revisions')
    .select('id, client_id')
    .eq('id', id)
    .eq('status', 'pending')
    .single()

  if (!revision) return NextResponse.json({ error: 'Revision not found or already reviewed' }, { status: 404 })

  // El service client bypasea RLS: la revisión debe pertenecer a la org del admin.
  const { data: ownerClient } = await service
    .from('clients')
    .select('organization_id')
    .eq('id', revision.client_id as string)
    .single()
  if (!ownerClient || orgMismatch(ctx, ownerClient.organization_id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (service as any)
    .from('brand_brain_revisions')
    .update({ status: 'rejected', reviewed_by: ctx.userId, reviewed_at: new Date().toISOString() })
    .eq('id', id)

  return NextResponse.json({ ok: true })
}
