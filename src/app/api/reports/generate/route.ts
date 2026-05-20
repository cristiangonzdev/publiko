import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { generateCopyOptions } from '@/lib/claude'
import { sendWeeklyReportEmail } from '@/lib/reports'
import Anthropic from '@anthropic-ai/sdk'

const ai = new Anthropic()

async function generateReportNarrative(
  businessName: string,
  stats: Record<string, number>,
  weekLabel: string,
): Promise<{ summary: string; recommendations: string }> {
  const res = await ai.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    messages: [
      {
        role: 'user',
        content: `Genera un resumen y recomendaciones para el informe semanal de redes sociales de "${businessName}".

DATOS DE LA SEMANA (${weekLabel}):
- Posts publicados: ${stats.posts}
- Alcance total: ${stats.reach}
- Likes: ${stats.likes}
- Guardados: ${stats.saves}
- Engagement medio: ${stats.engagement ? (stats.engagement * 100).toFixed(1) : '—'}%

Responde en JSON: {"summary":"2-3 frases narrativas sobre el rendimiento de la semana","recommendations":"2-3 frases con acciones concretas para la próxima semana"}
Idioma: español. Tono: profesional pero cercano.`,
      },
    ],
  })

  const text = res.content[0].type === 'text' ? res.content[0].text : '{}'
  const parsed = JSON.parse(text) as { summary: string; recommendations: string }
  return parsed
}

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-webhook-secret')
  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { client_id, week_start, week_end } = await request.json() as {
    client_id: string
    week_start: string
    week_end: string
  }

  const supabase = await createServiceClient()

  const [{ data: client }, { data: posts }] = await Promise.all([
    supabase
      .from('clients')
      .select('id, business_name, contact_email')
      .eq('id', client_id)
      .single(),
    supabase
      .from('posts')
      .select('id, copy, platform, reach, impressions, likes, saves, engagement_rate, published_at')
      .eq('client_id', client_id)
      .eq('status', 'published')
      .gte('published_at', week_start)
      .lte('published_at', week_end),
  ])

  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const postsData = posts ?? []
  const totalReach = postsData.reduce((s, p) => s + (p.reach ?? 0), 0)
  const totalLikes = postsData.reduce((s, p) => s + (p.likes ?? 0), 0)
  const totalSaves = postsData.reduce((s, p) => s + (p.saves ?? 0), 0)
  const avgEngagement = postsData.length > 0
    ? postsData.reduce((s, p) => s + (p.engagement_rate ?? 0), 0) / postsData.length
    : null

  const topPost = postsData.sort((a, b) => (b.reach ?? 0) - (a.reach ?? 0))[0] ?? null

  const weekLabel = `${new Date(week_start).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })} – ${new Date(week_end).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}`

  const narrative = await generateReportNarrative(client.business_name, {
    posts: postsData.length,
    reach: totalReach,
    likes: totalLikes,
    saves: totalSaves,
    engagement: avgEngagement ?? 0,
  }, weekLabel)

  const { data: report } = await supabase
    .from('weekly_reports')
    .upsert({
      client_id,
      week_start,
      week_end,
      posts_published: postsData.length,
      total_reach: totalReach,
      total_impressions: postsData.reduce((s, p) => s + (p.impressions ?? 0), 0),
      total_likes: totalLikes,
      total_saves: totalSaves,
      avg_engagement_rate: avgEngagement,
      top_post_id: topPost?.id ?? null,
      ai_summary: narrative.summary,
      ai_recommendations: narrative.recommendations,
    }, { onConflict: 'client_id,week_start' })
    .select('id')
    .single()

  if (client.contact_email) {
    await sendWeeklyReportEmail({
      businessName: client.business_name,
      contactEmail: client.contact_email,
      weekStart: week_start,
      weekEnd: week_end,
      postsPublished: postsData.length,
      totalReach,
      totalLikes,
      totalSaves,
      avgEngagementRate: avgEngagement,
      aiSummary: narrative.summary,
      aiRecommendations: narrative.recommendations,
      topPost: topPost
        ? { copy: topPost.copy, platform: topPost.platform, reach: topPost.reach ?? 0 }
        : undefined,
    })

    if (report?.id) {
      await supabase
        .from('weekly_reports')
        .update({ sent_to_client: true, sent_at: new Date().toISOString() })
        .eq('id', report.id)
    }
  }

  return NextResponse.json({ ok: true, report_id: report?.id })
}

// Silence unused import warning
void generateCopyOptions
