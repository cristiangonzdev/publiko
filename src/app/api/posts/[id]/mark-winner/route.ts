import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getAuthContext, orgMismatch } from '@/lib/auth/guards'

interface MarkWinnerBody {
  reason?: string
  features_override?: Record<string, unknown>
}

function extractHook(copy: string): string {
  const cleaned = copy
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/#\w+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned.split(/\s+/).slice(0, 5).join(' ')
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (ctx.role !== 'admin') {
    return NextResponse.json({ error: 'Solo admin puede marcar ganadores' }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as MarkWinnerBody
  const reason = body.reason?.trim()
  if (!reason || reason.length < 5) {
    return NextResponse.json({ error: 'Explica brevemente por qué funcionó (mín 5 caracteres)' }, { status: 400 })
  }

  const service = await createServiceClient()

  interface PostForWinner {
    id: string
    client_id: string
    task_id: string | null
    platform: string
    copy: string
    published_at: string | null
    reach: number | null
    impressions: number | null
    likes: number | null
    comments: number | null
    shares: number | null
    saves: number | null
    engagement_rate: number | null
    is_winner: boolean
    winner_source: string | null
  }

  const { data: post, error: postFetchErr } = await service
    .from('posts')
    .select('id, client_id, task_id, platform, copy, hashtags, published_at, reach, impressions, likes, comments, shares, saves, engagement_rate, is_winner, winner_source')
    .eq('id', id)
    .single() as { data: PostForWinner | null; error: { message: string } | null }

  if (postFetchErr && !post) return NextResponse.json({ error: postFetchErr.message }, { status: 500 })
  if (!post) return NextResponse.json({ error: 'Post no encontrado' }, { status: 404 })

  // El service client bypasea RLS: el post debe pertenecer a la org del admin.
  const { data: ownerClient } = await service
    .from('clients')
    .select('organization_id')
    .eq('id', post.client_id)
    .single()
  if (!ownerClient || orgMismatch(ctx, ownerClient.organization_id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // content_type vive en content_tasks; angle/concept en content_ideas,
  // enlazado por content_tasks.idea_id (no existen como columnas en tasks).
  let contentType: string | null = null
  let angle: string | null = null
  let conceptSummary: string | null = null
  if (post.task_id) {
    interface TaskRow { content_type: string | null; idea_id: string | null }
    const { data: task, error: taskErr } = await service
      .from('content_tasks')
      .select('content_type, idea_id')
      .eq('id', post.task_id)
      .single() as { data: TaskRow | null; error: { message: string } | null }
    if (taskErr && !task) return NextResponse.json({ error: taskErr.message }, { status: 500 })
    contentType = task?.content_type ?? null

    if (task?.idea_id) {
      interface IdeaRow { angle: string | null; concept: string | null }
      const { data: idea, error: ideaErr } = await service
        .from('content_ideas')
        .select('angle, concept')
        .eq('id', task.idea_id)
        .single() as { data: IdeaRow | null; error: { message: string } | null }
      if (ideaErr && !idea) return NextResponse.json({ error: ideaErr.message }, { status: 500 })
      angle = idea?.angle ?? null
      conceptSummary = idea?.concept ?? null
    }
  }

  const publishDate = post.published_at ? new Date(post.published_at) : null
  const features = {
    content_type: contentType,
    angle,
    platform: post.platform,
    hook: extractHook(post.copy ?? ''),
    concept_summary: conceptSummary,
    publish_hour: publishDate ? String(publishDate.getHours()).padStart(2, '0') : null,
    weekday: publishDate
      ? ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][publishDate.getDay()]
      : null,
    copy_excerpt: (post.copy ?? '').slice(0, 280),
    ...(body.features_override ?? {}),
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

  const finalSource = post.is_winner && post.winner_source === 'auto' ? 'hybrid' : 'manual'

  const { error: postErr } = await service
    .from('posts')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({
      is_winner: true,
      winner_source: finalSource,
      winner_marked_at: new Date().toISOString(),
    } as any)
    .eq('id', id)

  if (postErr) return NextResponse.json({ error: postErr.message }, { status: 500 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pattern, error: patternErr } = await (service.from('winning_patterns') as any)
    .insert({
      client_id: post.client_id,
      post_id: post.id,
      source: finalSource,
      features,
      manual_reason: reason,
      metrics_snapshot: metricsSnapshot,
      marked_by: ctx.userId,
      active: true,
    })
    .select('id')
    .single() as { data: { id: string } | null; error: { message: string } | null }

  if (patternErr) return NextResponse.json({ error: patternErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, pattern_id: pattern?.id })
}
