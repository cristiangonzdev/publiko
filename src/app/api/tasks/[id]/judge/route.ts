import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { judgeContent, type JudgeVerdict } from '@/lib/claude'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = await createServiceClient()
  const { data: task } = await service
    .from('content_tasks')
    .select('id, client_id, title, content_type, copy_selected, hashtags, cta')
    .eq('id', id)
    .single()
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  if (!task.copy_selected) return NextResponse.json({ error: 'No copy_selected to judge' }, { status: 400 })

  const { data: brain } = await service.from('brand_brains').select('*').eq('client_id', task.client_id).single()

  let verdict: JudgeVerdict
  try {
    verdict = await judgeContent(brain as unknown as Record<string, unknown>, {
      concept: task.title,
      content_type: task.content_type,
      copy: task.copy_selected,
      hashtags: (task.hashtags as string[]) ?? [],
      cta: task.cta ?? undefined,
      kind: task.content_type === 'story' ? 'story' : 'feed',
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }

  await service
    .from('content_tasks')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({
      judge_verdict: verdict,
      judge_run_at: new Date().toISOString(),
      auto_publish_blocked_reason: verdict.passes ? null : verdict.issues.join('; '),
      updated_at: new Date().toISOString(),
    } as any)
    .eq('id', id)

  return NextResponse.json({ verdict })
}
