import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { generateDailyBatch, type DailyGenerationConfig } from '@/lib/claude'
import { notifyAdmin } from '@/lib/telegram'
import { loadWinningPatterns, attachWinningPatterns } from '@/lib/winning-patterns/inject'
import { sanitizeIdea } from '@/lib/content'
import { mapLimit } from '@/lib/async'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

// Concurrencia acotada: a 100 clientes, disparar todo en paralelo satura los
// rate limits de Claude y revienta el maxDuration. 5 clientes a la vez.
const CLIENT_CONCURRENCY = 5
const AUTO_PROCESS_CONCURRENCY = 3

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = await createServiceClient()

  // Active clients with a non-empty daily_generation_config
  const { data: clients } = await service
    .from('clients')
    .select('id, business_name, daily_generation_config')
    .eq('status', 'active')
    .is('deleted_at', null)

  const eligible = (clients ?? []).filter((c) => {
    const cfg = c.daily_generation_config as DailyGenerationConfig | null
    if (!cfg) return false
    return (cfg.reels_per_day ?? 0) + (cfg.posts_per_day ?? 0) + (cfg.stories_per_day ?? 0) + (cfg.carrusels_per_day ?? 0) > 0
  })

  if (eligible.length === 0) return NextResponse.json({ ok: true, clients_processed: 0 })

  const todayISO = new Date().toISOString().slice(0, 10)
  const dateLabel = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })

  const results: Array<{
    client_id: string
    business_name: string
    inserted: number
    auto: number
    manual: number
    auto_queued: number
    error?: string
  }> = []

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? ''

  await mapLimit(eligible, CLIENT_CONCURRENCY, async (c) => {
    try {
      const cfg = c.daily_generation_config as DailyGenerationConfig

      const [{ data: brain }, { data: recent }, winningPatterns] = await Promise.all([
        service.from('brand_brains').select('*').eq('client_id', c.id).single(),
        service
          .from('content_ideas')
          .select('concept, angle, content_type, status')
          .eq('client_id', c.id)
          .order('created_at', { ascending: false })
          .limit(50),
        loadWinningPatterns(service, c.id),
      ])

      if (!brain?.onboarding_completed) {
        results.push({ client_id: c.id, business_name: c.business_name, inserted: 0, auto: 0, manual: 0, auto_queued: 0, error: 'Brand Brain incomplete' })
        return
      }

      const brainWithPatterns = attachWinningPatterns(
        brain as unknown as Record<string, unknown>,
        winningPatterns,
      )

      const batch = await generateDailyBatch(
        brainWithPatterns,
        (recent ?? []) as unknown as Array<Record<string, unknown>>,
        cfg,
        dateLabel,
      )

      const sanitized = batch.map((idea) => {
        const s = sanitizeIdea(idea, { typeFallback: 'story', angleFallback: 'detras_escenas' })
        return {
          client_id: c.id,
          concept: s.concept,
          full_description: s.full_description,
          content_type: s.content_type,
          angle: s.angle,
          content_origin: 'system' as const,
          content_pillar: s.content_pillar,
          approval_tier: s.approval_tier,
          scheduled_for_date: todayISO,
          status: 'suggested' as const,
          can_recycle_after: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
          suggested_publish_time: s.suggested_publish_time,
        }
      })

      if (sanitized.length === 0) {
        results.push({ client_id: c.id, business_name: c.business_name, inserted: 0, auto: 0, manual: 0, auto_queued: 0 })
        return
      }

      const { data: inserted, error: insertError } = await service
        .from('content_ideas')
        .insert(sanitized)
        .select('id, approval_tier, content_type')

      if (insertError) {
        results.push({ client_id: c.id, business_name: c.business_name, inserted: 0, auto: 0, manual: 0, auto_queued: 0, error: insertError.message })
        return
      }

      const ideasInserted = inserted ?? []
      const autoIdeas = ideasInserted.filter((i) => i.approval_tier === 'auto')
      const manualCount = ideasInserted.length - autoIdeas.length

      // Auto-process de las ideas auto-tier, con concurrencia acotada.
      // Cada una crea tarea + copies por plataforma + corre el juez.
      let autoOk = 0
      if (baseUrl) {
        const autoResults = await mapLimit(autoIdeas, AUTO_PROCESS_CONCURRENCY, (idea) =>
          fetch(`${baseUrl}/api/ideas/${idea.id}/auto-process`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              authorization: `Bearer ${process.env.CRON_SECRET}`,
            },
            body: JSON.stringify({}),
          })
            .then((r) => r.ok)
            .catch(() => false),
        )
        autoOk = autoResults.filter(Boolean).length
      } else {
        console.error('[daily-generation] NEXT_PUBLIC_APP_URL no configurado: auto-process omitido')
      }

      results.push({
        client_id: c.id,
        business_name: c.business_name,
        inserted: ideasInserted.length,
        auto: autoIdeas.length,
        manual: manualCount,
        auto_queued: autoOk,
      })
    } catch (err) {
      results.push({
        client_id: c.id,
        business_name: c.business_name,
        inserted: 0,
        auto: 0,
        manual: 0,
        auto_queued: 0,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  })

  const totalInserted = results.reduce((s, r) => s + r.inserted, 0)
  const totalAuto = results.reduce((s, r) => s + r.auto, 0)
  const totalManual = results.reduce((s, r) => s + r.manual, 0)

  if (totalInserted > 0) {
    const lines = results
      .map((r) => `• ${r.business_name}: ${r.inserted} (${r.auto} auto, ${r.manual} manual)${r.error ? ` — ⚠️ ${r.error}` : ''}`)
      .join('\n')
    await notifyAdmin(`📅 <b>Plan diario generado</b>\n\n${dateLabel}\n${totalInserted} piezas (${totalAuto} auto, ${totalManual} a revisar)\n\n${lines}`)
  }

  return NextResponse.json({ ok: true, clients_processed: results.length, results })
}
