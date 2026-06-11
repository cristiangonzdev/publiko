import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getAuthContext, orgMismatch } from '@/lib/auth/guards'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (ctx.role !== 'admin') {
    return NextResponse.json({ error: 'Solo admin' }, { status: 403 })
  }

  const { reason } = (await request.json().catch(() => ({}))) as { reason?: string }

  const service = await createServiceClient()

  // El service client bypasea RLS: el patrón debe pertenecer a la org del admin.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pattern } = await (service.from('winning_patterns') as any)
    .select('client_id')
    .eq('id', id)
    .single() as { data: { client_id: string } | null }
  if (!pattern) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: ownerClient } = await service
    .from('clients')
    .select('organization_id')
    .eq('id', pattern.client_id)
    .single()
  if (!ownerClient || orgMismatch(ctx, ownerClient.organization_id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (service.from('winning_patterns') as any)
    .update({ active: false, archived_reason: reason ?? null, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
