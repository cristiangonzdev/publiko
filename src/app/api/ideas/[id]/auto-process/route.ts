import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getAuthContext, orgMismatch, type AuthContext } from '@/lib/auth/guards'
import {
  generateCopyOptions,
  generateBriefs,
  generateCopiesPerPlatform,
  judgeContent,
  type JudgeVerdict,
} from '@/lib/claude'
import { notifyAdmin } from '@/lib/telegram'
import { loadWinnerExamples } from '@/lib/winning-patterns/examples'
import { madridWallTimeToUtcISO } from '@/lib/datetime'
import { schedulePostsForTask } from '@/lib/posts/schedule'

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

  let ctx: AuthContext | null = null
  if (!fromCron) {
    ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (ctx.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const service = await createServiceClient()

  const { data: idea } = await service
    .from('content_ideas')
    .select('*, clients!inner(id, business_name, daily_generation_config, organization_id)')
    .eq('id', id)
    .single()

  if (!idea) return NextResponse.json({ error: 'Idea not found' }, { status: 404 })

  // Rama de sesión admin: el service client bypasea RLS, así que la idea debe
  // pertenecer a la org del admin. La rama CRON_SECRET es org-agnóstica.
  if (ctx) {
    const ideaOrg = (idea.clients as unknown as { organization_id: string | null })?.organization_id
    if (orgMismatch(ctx, ideaOrg)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }
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

  const fewShotExamples = await loadWinnerExamples(idea.client_id as string)

  let copyOptions, briefs, perPlatform
  try {
    [copyOptions, briefs, perPlatform] = await Promise.all([
      generateCopyOptions(brainRecord, ideaRecord, fewShotExamples),
      generateBriefs(brainRecord, ideaRecord),
      generateCopiesPerPlatform(brainRecord, ideaRecord, platforms, fewShotExamples),
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
      kind: idea.content_type === 'story' ? 'story' : 'feed',
    })
  } catch (err) {
    verdict = {
      passes: false,
      score: 0,
      confidence: 'low',
      axes: { voice_fidelity: 0, hook_strength: 0, cta_clarity: 0, originality: 0, platform_nativity: 0 },
      similarity_flag: false,
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
  // Additional gates: low confidence or similarity always escalates to human
  const effectivePasses = verdict.passes && verdict.confidence !== 'low' && !verdict.similarity_flag

  if (effectivePasses) {
    // Hora sugerida (Madrid) → UTC. Empuja a mañana si ya pasó.
    const suggestedTime = (idea.suggested_publish_time as string | null) ?? '12:00'
    const publishAtIso = madridWallTimeToUtcISO(suggestedTime)

    // El auto-tier necesita un asset para publicar. Si no se grabó/editó nada,
    // usamos el b-roll más reciente del cliente; si no hay, NO se agenda (se
    // queda aprobado y se avisa al admin) — antes agendaba sin media y el
    // publish fallaba siempre.
    const { data: broll } = await service
      .from('assets')
      .select('id')
      .eq('client_id', idea.client_id)
      .eq('asset_category', 'b_roll')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!broll?.id) {
      await service
        .from('content_tasks')
        .update({
          status: 'approved',
          publish_at: publishAtIso,
          approved_at: new Date().toISOString(),
          auto_publish_blocked_reason: 'Auto-aprobado por el juez, pero falta media. Sube un b-roll o produce la pieza para programarla.',
          updated_at: new Date().toISOString(),
        })
        .eq('id', task.id)
      await service.from('content_ideas').update({ status: 'approved' }).eq('id', id)
      const businessName = (idea.clients as unknown as { business_name: string })?.business_name ?? ''
      await notifyAdmin(`✅ <b>Auto-aprobado (sin media)</b>\n\n${businessName}\n${idea.concept}\n\nEl juez lo aprobó pero no hay b-roll para publicar. Súbelo o prográmalo a mano.`)
      return NextResponse.json({ ok: true, task_id: task.id, scheduled_for: null, awaiting_media: true, verdict })
    }

    await service
      .from('content_tasks')
      .update({
        final_asset_id: broll.id,
        publish_at: publishAtIso,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', task.id)

    const sched = await schedulePostsForTask(service, task.id)
    if (sched.error) {
      await notifyAdmin(`⚠️ <b>Auto-tier: no se pudo programar</b>\n\n${idea.concept}\n${sched.error}`)
      return NextResponse.json({ ok: true, task_id: task.id, scheduled_for: null, schedule_error: sched.error, verdict })
    }

    await service
      .from('content_ideas')
      .update({ status: 'in_production' })
      .eq('id', id)

    return NextResponse.json({ ok: true, task_id: task.id, scheduled_for: publishAtIso, posts_created: sched.created, verdict })
  }

  // Judge failed — flag for admin
  const blockedReasons = [...verdict.issues]
  if (verdict.confidence === 'low') blockedReasons.push(`Confianza baja del juez (${verdict.confidence})`)
  if (verdict.similarity_flag) blockedReasons.push('Concepto demasiado similar a contenido reciente')

  await service
    .from('content_tasks')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({
      auto_publish_blocked_reason: blockedReasons.join('; '),
      updated_at: new Date().toISOString(),
    } as any)
    .eq('id', task.id)

  const axesSummary = verdict.axes
    ? `Ejes: voz=${(verdict.axes.voice_fidelity * 10).toFixed(0)}/10 · hook=${(verdict.axes.hook_strength * 10).toFixed(0)}/10 · cta=${(verdict.axes.cta_clarity * 10).toFixed(0)}/10`
    : ''
  const businessName = (idea.clients as unknown as { business_name: string })?.business_name ?? ''
  await notifyAdmin(
    `⚠️ <b>Auto-judge rechazó</b>\n\n${businessName}\n${idea.concept}\n\n${axesSummary}\nMotivos:\n${blockedReasons.map((i) => `• ${i}`).join('\n')}\n\nRevisar manualmente.`,
  )

  return NextResponse.json({ ok: true, task_id: task.id, scheduled_for: null, verdict })
}
