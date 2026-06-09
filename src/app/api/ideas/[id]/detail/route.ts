import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/guards'

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

  const { data: task } = await service
    .from('content_tasks')
    .select('id, recording_brief, editing_brief, copy_options, copy_selected, hashtags, cta, status, grabador_id, editor_id, deadline, bruto_asset_ids, approval_tier, copies_per_platform, judge_verdict, judge_run_at, auto_publish_blocked_reason, target_platforms, publish_at')
    .eq('idea_id', id)
    .maybeSingle()

  return NextResponse.json({ idea, task: task ?? null })
}
