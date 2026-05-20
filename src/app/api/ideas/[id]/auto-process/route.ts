import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import {
  generateCopyOptions,
  generateBriefs,
  generateCopiesPerPlatform,
  judgeContent,
  type JudgeVerdict,
} from '@/lib/claude'
import { notifyAdmin } from '@/lib/telegram'

export const runtime = 'nodejs'
export const maxDuration = 120
export const dynamic = 'force-dynamic'

/**
 * Auto-process an auto-tier idea end-to-end:
 *   1. Mark idea approved
 *   2. Create the content_task (with copy_options, briefs, copies_per_platform)
 *   3. Run AI Judge on the first platform copy
 *   4. If judge passes → schedule task (status=scheduled, publish_at set)
 *   5. If judge fails → leave at approved_idea + admin notification with reason
 *
 * Auth: either an admin user session OR the CRON_SECRET bearer (so daily-generation
 * can fan out and call this in parallel without a user context).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const authHeader = request.headers.get('authorization')
  const fromCron = authHeader === `Bearer ${process.env.CRON_SECRET}`

  if (!fromCron) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = await createServiceClient()

  const { data: idea } = await service
    .from('content_ideas')
    .select('*, clients!inner(id, business_name, daily_generation_config)')
    .eq('id', id)
    .single()

  if (!idea) return NextResponse.json({ error: 'Idea not found' }, { status: 404 })
  if (idea.status === 'in_production' || idea.status === 'published') {
    return NextResponse.json({ ok: true, skipped: 'already past production' })
  }

  const { data: brain } = await service
    .from('brand_brains')
    .select('*')
    .eq('client_id', idea.client_id)
    .single()

  const clientCfg = (idea.clients as unknown as { daily_generation_config: Record<string, unknown> })?.daily_generation_config ?? {}
  const platforms = ((clientCfg.platforms as string[]) ?? ['instagram'])

  // 1. Approve the idea
  await service
    .from('content_ideas')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ status: 'approved', approved_at: new Date().toISOString() } as any)
    .eq('id', id)

  // 2. Generate copy options, briefs, per-platform copies in parallel
  const ideaRecord = idea as unknown as Record<string, unknown>
  const brainRecord = (brain ?? {}) as unknown as Record<string, unknown>

  let copyOptions, briefs, perPlatform
  try {
    [copyOptions, briefs, perPlatform] = await Promise.all([
      generateCopyOptions(brainRecord, ideaRecord),
      generateBriefs(brainRecord, ideaRecord),
      generateCopiesPerPlatform(brainRecord, ideaRecord, platforms),
    ])
  } catch (err) {
    await notifyAdmin(`⚠️ <b>Auto-process falló (Claude)</b>\n\n${idea.concept}\n${err instanceof Error ? err.message : String(err)}`)
    return NextResponse.json({ error: 'Claude generation failed' }, { status: 500 })
  }

  // Pick first platform copy as the canonical copy_selected (matches existing pipeline)
  const firstPlatform = platforms[0]
  const chosen = perPlatform[firstPlatform] ?? copyOptions[0] ?? { copy: '', hashtags: [], cta: null }

  // 3. Create the task
  const { data: task } = await service
    .from('content_tasks')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert({
      client_id: idea.client_id,
      idea_id: id,
      title: idea.concept,
      content_type: idea.content_type,
      copy_options: copyOptions,
      copy_selected: chosen.copy,
      hashtags: chosen.hashtags ?? [],
      cta: chosen.cta ?? null,
      copies_per_platform: perPlatform,
      recording_brief: briefs.recording_brief,
      editing_brief: briefs.editing_brief,
      target_platforms: platforms,
      approval_tier: 'auto',
      status: 'approved_idea',
    } as any)
    .select('id')
    .single()

  if (!task) {
    return NextResponse.json({ error: 'Task insert failed' }, { status: 500 })
  }

  await service
    .from('content_ideas')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ content_task_id: task.id } as any)
    .eq('id', id)

  // 4. Run judge on the canonical copy
  let verdict: JudgeVerdict
  try {
    verdict = await judgeContent(brainRecord, {
      concept: idea.concept,
      content_type: idea.content_type,
      copy: chosen.copy,
      hashtags: chosen.hashtags,
      cta: chosen.cta ?? undefined,
    })
  } catch (err) {
    verdict = {
      passes: false,
      score: 0,
      issues: [`Judge error: ${err instanceof Error ? err.message : String(err)}`],
      reasoning: 'Could not run judge — defaulting to manual review.',
    }
  }

  await service
    .from('content_tasks')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({
      judge_verdict: verdict,
      judge_run_at: new Date().toISOString(),
    } as any)
    .eq('id', task.id)

  // 5. Schedule or route to manual review
  if (verdict.passes) {
    // Pick publish_at from suggested time (stored in idea.human_input) or default to 12:00 today
    const suggestedTime = (idea.human_input as string | null) ?? '12:00'
    const [hh, mm] = suggestedTime.split(':').map((n) => parseInt(n, 10))
    const publishAt = new Date()
    publishAt.setHours(isNaN(hh) ? 12 : hh, isNaN(mm) ? 0 : mm, 0, 0)
    // If already past, push to tomorrow
    if (publishAt.getTime() < Date.now()) publishAt.setDate(publishAt.getDate() + 1)

    await service
      .from('content_tasks')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({
        status: 'scheduled',
        publish_at: publishAt.toISOString(),
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', task.id)

    await service
      .from('content_ideas')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ status: 'in_production' } as any)
      .eq('id', id)

    return NextResponse.json({ ok: true, task_id: task.id, scheduled_for: publishAt.toISOString(), verdict })
  }

  // Judge failed — flag for admin
  await service
    .from('content_tasks')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({
      auto_publish_blocked_reason: verdict.issues.join('; '),
      updated_at: new Date().toISOString(),
    } as any)
    .eq('id', task.id)

  const businessName = (idea.clients as unknown as { business_name: string })?.business_name ?? ''
  await notifyAdmin(
    `⚠️ <b>Auto-judge rechazó</b>\n\n${businessName}\n${idea.concept}\n\nMotivos:\n${verdict.issues.map((i) => `• ${i}`).join('\n')}\n\nRevisar manualmente.`,
  )

  return NextResponse.json({ ok: true, task_id: task.id, scheduled_for: null, verdict })
}
