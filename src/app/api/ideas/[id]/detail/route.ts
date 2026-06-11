import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin, orgMismatch } from '@/lib/auth/guards'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { id } = await params

  const service = await createServiceClient()

  const { data: idea } = await service
    .from('content_ideas')
    .select('*')
    .eq('id', id)
    .single()

  if (!idea) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // El service client bypasea RLS: la idea debe pertenecer a la org del admin.
  const { data: ownerClient } = await service
    .from('clients')
    .select('organization_id')
    .eq('id', idea.client_id)
    .single()
  if (!ownerClient || orgMismatch(auth.ctx, ownerClient.organization_id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: task } = await service
    .from('content_tasks')
    .select('id, recording_brief, editing_brief, copy_options, copy_selected, hashtags, cta, status, grabador_id, editor_id, deadline, bruto_asset_ids, approval_tier, copies_per_platform, judge_verdict, judge_run_at, auto_publish_blocked_reason, target_platforms, publish_at')
    .eq('idea_id', id)
    .maybeSingle()

  return NextResponse.json({ idea, task: task ?? null })
}
