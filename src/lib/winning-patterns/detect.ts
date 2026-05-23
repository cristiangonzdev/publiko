import type { SupabaseClient } from '@supabase/supabase-js'

const WINNER_MULTIPLIER_THRESHOLD = 1.6
const HOOK_WORDS = 5

interface PostRow {
  id: string
  client_id: string
  task_id: string | null
  platform: string
  external_post_id: string | null
  copy: string
  hashtags: string[] | null
  published_at: string | null
  reach: number | null
  engagement_rate: number | null
  impressions: number | null
  likes: number | null
  comments: number | null
  shares: number | null
  saves: number | null
}

interface BaselineRow {
  median_engagement_rate: number | null
  p75_engagement_rate: number | null
}

interface TaskRow {
  content_type: string | null
  angle: string | null
  concept: string | null
}

function extractHook(copy: string): string {
  const cleaned = copy
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/#\w+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned.split(/\s+/).slice(0, HOOK_WORDS).join(' ')
}

function detectCta(copy: string): boolean {
  const ctaSignals = /reserva|llama|visita|ven|prueba|descubre|apunt|síguenos|s[íi]guenos|comenta|comparte|guarda|click|enlace|link in bio/i
  return ctaSignals.test(copy)
}

function publishHourAndDay(publishedAt: string | null): { hour: string | null; weekday: string | null } {
  if (!publishedAt) return { hour: null, weekday: null }
  const d = new Date(publishedAt)
  const hour = String(d.getHours()).padStart(2, '0')
  const weekday = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][d.getDay()]
  return { hour, weekday }
}

export interface DetectionResult {
  client_id: string
  posts_evaluated: number
  winners_marked: number
  patterns_created: number
}

export async function detectAndMarkWinners(
  supabase: SupabaseClient,
  clientId: string,
): Promise<DetectionResult> {
  await supabase.rpc('compute_client_baseline', { p_client_id: clientId })

  const lookback = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: posts } = await supabase
    .from('posts')
    .select('id, client_id, task_id, platform, external_post_id, copy, hashtags, published_at, reach, engagement_rate, impressions, likes, comments, shares, saves')
    .eq('client_id', clientId)
    .eq('status', 'published')
    .eq('is_winner', false)
    .gte('published_at', lookback)
    .not('engagement_rate', 'is', null)

  if (!posts?.length) {
    return { client_id: clientId, posts_evaluated: 0, winners_marked: 0, patterns_created: 0 }
  }

  const typedPosts = posts as unknown as PostRow[]
  const taskIds = typedPosts.map((p) => p.task_id).filter((id): id is string => !!id)
  const tasksById = new Map<string, TaskRow>()
  if (taskIds.length > 0) {
    const { data: tasks } = await supabase
      .from('content_tasks')
      .select('id, content_type, angle, concept')
      .in('id', taskIds)
    for (const t of (tasks ?? []) as Array<{ id: string } & TaskRow>) {
      tasksById.set(t.id, { content_type: t.content_type, angle: t.angle, concept: t.concept })
    }
  }

  const { data: baselines } = await supabase
    .from('client_performance_baselines')
    .select('platform, content_type, median_engagement_rate, p75_engagement_rate')
    .eq('client_id', clientId)

  const baselineMap = new Map<string, BaselineRow>()
  for (const b of (baselines ?? []) as Array<{ platform: string; content_type: string } & BaselineRow>) {
    baselineMap.set(`${b.platform}::${b.content_type}`, b)
  }

  let winnersMarked = 0
  let patternsCreated = 0

  for (const post of typedPosts) {
    const task = post.task_id ? tasksById.get(post.task_id) : null
    const contentType = task?.content_type ?? 'post'
    const baseline = baselineMap.get(`${post.platform}::${contentType}`)
    const median = baseline?.median_engagement_rate ?? null

    if (median === null || median <= 0) continue

    const ratio = (post.engagement_rate ?? 0) / median
    if (ratio < WINNER_MULTIPLIER_THRESHOLD) continue

    const { hour, weekday } = publishHourAndDay(post.published_at)
    const features = {
      content_type: contentType,
      angle: task?.angle ?? null,
      platform: post.platform,
      hook: extractHook(post.copy),
      concept_summary: task?.concept ?? null,
      publish_hour: hour,
      weekday,
      has_cta: detectCta(post.copy),
      copy_excerpt: post.copy.slice(0, 280),
    }

    const metricsSnapshot = {
      reach: post.reach,
      impressions: post.impressions,
      likes: post.likes,
      comments: post.comments,
      shares: post.shares,
      saves: post.saves,
      engagement_rate: post.engagement_rate,
    }

    const { error: postUpdateErr } = await supabase
      .from('posts')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({
        is_winner: true,
        winner_source: 'auto',
        winner_score: ratio,
        winner_marked_at: new Date().toISOString(),
        baseline_engagement_at_publish: median,
      } as any)
      .eq('id', post.id)

    if (postUpdateErr) continue
    winnersMarked++

    const { error: patternErr } = await supabase
      .from('winning_patterns')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert({
        client_id: clientId,
        post_id: post.id,
        source: 'auto',
        features,
        metrics_snapshot: metricsSnapshot,
        impact_multiplier: ratio,
        active: true,
      } as any)

    if (!patternErr) patternsCreated++
  }

  return {
    client_id: clientId,
    posts_evaluated: typedPosts.length,
    winners_marked: winnersMarked,
    patterns_created: patternsCreated,
  }
}
