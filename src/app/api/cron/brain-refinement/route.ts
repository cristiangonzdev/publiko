import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { generateBrainRefinementProposal } from '@/lib/claude'

export const maxDuration = 300

interface PostRow {
  id: string
  copy: string
  platform: string
  engagement_rate: string | null
  published_at: string | null
  task_id: string | null
}

interface TaskRow {
  id: string
  title: string
  content_type: string
  idea_id: string | null
}

interface IdeaRow {
  id: string
  concept: string | null
  angle: string | null
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createServiceClient()

  const { data: clients } = await supabase
    .from('clients')
    .select('id, business_name')
    .eq('status', 'active')

  if (!clients || clients.length === 0) {
    return NextResponse.json({ ok: true, processed: 0 })
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const results = await Promise.all(
    clients.map(async (c) => {
      try {
        const [{ data: brain }, { data: rawPosts }] = await Promise.all([
          supabase.from('brand_brains').select('*').eq('client_id', c.id).single(),
          supabase
            .from('posts')
            .select('id, copy, platform, engagement_rate, published_at, task_id')
            .eq('client_id', c.id)
            .eq('status', 'published')
            .gte('published_at', thirtyDaysAgo)
            .order('published_at', { ascending: false })
            .limit(20),
        ])

        if (!brain || !rawPosts || rawPosts.length < 5) {
          return { client_id: c.id, skipped: 'insufficient data' }
        }

        const posts = rawPosts as unknown as PostRow[]

        // content_type lives on content_tasks; angle/concept live on content_ideas (via idea_id).
        const taskIds = posts.map((p) => p.task_id).filter(Boolean) as string[]
        const { data: rawTasks } = taskIds.length > 0
          ? await supabase.from('content_tasks').select('id, title, content_type, idea_id').in('id', taskIds)
          : { data: [] }

        const tasks = (rawTasks ?? []) as unknown as TaskRow[]
        const taskMap = new Map(tasks.map((t) => [t.id, t]))

        const ideaIds = tasks.map((t) => t.idea_id).filter(Boolean) as string[]
        const { data: rawIdeas } = ideaIds.length > 0
          ? await supabase.from('content_ideas').select('id, concept, angle').in('id', ideaIds)
          : { data: [] }

        const ideas = (rawIdeas ?? []) as unknown as IdeaRow[]
        const ideaMap = new Map(ideas.map((i) => [i.id, i]))

        const sorted = [...posts].sort(
          (a, b) => Number(b.engagement_rate ?? 0) - Number(a.engagement_rate ?? 0),
        )
        const median = Number(sorted[Math.floor(sorted.length / 2)]?.engagement_rate ?? 0)

        const enriched = sorted.map((p) => {
          const task = taskMap.get(p.task_id ?? '')
          const idea = task?.idea_id ? ideaMap.get(task.idea_id) : undefined
          return {
            concept: idea?.concept ?? task?.title ?? p.copy.slice(0, 80),
            content_type: task?.content_type ?? 'post',
            angle: idea?.angle ?? 'informativo',
            engagement_rate: Number(p.engagement_rate ?? 0),
          }
        })

        const top = enriched.filter((p) => p.engagement_rate >= median * 1.3).slice(0, 5)
        const under = enriched.filter((p) => p.engagement_rate < median * 0.7).slice(-5)

        // get_winning_patterns_for_prompt exists in DB but not in generated types — cast
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: patterns } = await (supabase as any).rpc('get_winning_patterns_for_prompt', {
          p_client_id: c.id,
          p_limit: 5,
        })

        const patternSummary = (patterns as Array<{ features: { concept_summary?: string; angle?: string } }> ?? [])
          .map((p) => `${p.features?.angle ?? '?'}: ${p.features?.concept_summary ?? '?'}`)
          .join(' | ')

        const proposals = await generateBrainRefinementProposal(
          brain as unknown as Record<string, unknown>,
          { top_performers: top, underperformers: under, winning_patterns_summary: patternSummary },
        )

        if (proposals.length === 0) {
          return { client_id: c.id, proposals: 0 }
        }

        const rows = proposals.map((p) => ({
          client_id: c.id,
          section: p.section,
          proposed_changes: p.proposed_changes,
          reasoning: p.reasoning,
        }))

        // brand_brain_revisions added in migration 0012 — cast via as any
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('brand_brain_revisions').insert(rows)

        return { client_id: c.id, proposals: proposals.length }
      } catch (err) {
        return { client_id: c.id, error: err instanceof Error ? err.message : String(err) }
      }
    }),
  )

  return NextResponse.json({ ok: true, results })
}
