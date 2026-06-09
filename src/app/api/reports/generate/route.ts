import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendWeeklyReportEmail } from '@/lib/reports'
import Anthropic from '@anthropic-ai/sdk'

const ai = new Anthropic()

type ChurnLevel = 'low' | 'medium' | 'high'

function computeChurnRisk(
  postsCount: number,
  avgEngagement: number | null,
  prevEngagement: number | null,
  hasOverdueInvoice: boolean,
): { level: ChurnLevel; factors: string[]; engagementChangePct: number | null } {
  const factors: string[] = []
  let score = 0

  // Engagement drop
  let engagementChangePct: number | null = null
  if (avgEngagement != null && prevEngagement != null && prevEngagement > 0) {
    engagementChangePct = ((avgEngagement - prevEngagement) / prevEngagement) * 100
    if (engagementChangePct < -20) {
      factors.push(`Caída de engagement del ${Math.abs(engagementChangePct).toFixed(0)}% vs semana anterior`)
      score += 2
    } else if (engagementChangePct < -10) {
      factors.push(`Bajada de engagement del ${Math.abs(engagementChangePct).toFixed(0)}% vs semana anterior`)
      score += 1
    }
  }

  // Posts published count
  if (postsCount === 0) {
    factors.push('Sin publicaciones esta semana')
    score += 2
  } else if (postsCount < 2) {
    factors.push('Muy pocas publicaciones esta semana')
    score += 1
  }

  // Overdue invoice
  if (hasOverdueInvoice) {
    factors.push('Factura pendiente de pago')
    score += 1
  }

  const level: ChurnLevel = score >= 3 ? 'high' : score >= 1 ? 'medium' : 'low'
  return { level, factors, engagementChangePct }
}

async function generateReportNarrative(
  businessName: string,
  stats: Record<string, number>,
  weekLabel: string,
  churnLevel: ChurnLevel,
  churnFactors: string[],
): Promise<{ summary: string; recommendations: string; executive_narrative: string }> {
  const churnContext = churnLevel !== 'low'
    ? `\nALERTA: riesgo de churn ${churnLevel.toUpperCase()}. Factores: ${churnFactors.join('; ')}.`
    : ''

  const res = await ai.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 900,
    messages: [
      {
        role: 'user',
        content: `Genera el informe semanal de redes sociales de "${businessName}".

DATOS DE LA SEMANA (${weekLabel}):
- Posts publicados: ${stats.posts}
- Alcance total: ${stats.reach}
- Likes: ${stats.likes}
- Guardados: ${stats.saves}
- Engagement medio: ${stats.engagement ? (stats.engagement * 100).toFixed(1) : '—'}%${churnContext}

Responde en JSON:
{
  "summary": "2-3 frases narrativas breves sobre el rendimiento",
  "recommendations": "2-3 frases con acciones concretas para la próxima semana",
  "executive_narrative": "párrafo completo de 4-6 frases para el admin: tendencia, puntos clave, señales de riesgo si las hay, y recomendación prioritaria"
}
Idioma: español. Tono: profesional pero cercano.`,
      },
    ],
  })

  const text = res.content[0].type === 'text' ? res.content[0].text : '{}'
  const parsed = JSON.parse(text) as { summary: string; recommendations: string; executive_narrative: string }
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

  const [{ data: client }, { data: posts }, { data: prevReport }] = await Promise.all([
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
    supabase
      .from('weekly_reports')
      .select('avg_engagement_rate')
      .eq('client_id', client_id)
      .lt('week_start', week_start)
      .order('week_start', { ascending: false })
      .limit(1)
      .single(),
  ])

  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const postsData = posts ?? []
  const totalReach = postsData.reduce((s, p) => s + (p.reach ?? 0), 0)
  const totalLikes = postsData.reduce((s, p) => s + (p.likes ?? 0), 0)
  const totalSaves = postsData.reduce((s, p) => s + (p.saves ?? 0), 0)
  const avgEngagement = postsData.length > 0
    ? postsData.reduce((s, p) => s + (p.engagement_rate ?? 0), 0) / postsData.length
    : null

  const prevEngagement = prevReport?.avg_engagement_rate != null
    ? Number(prevReport.avg_engagement_rate)
    : null

  const churn = computeChurnRisk(postsData.length, avgEngagement, prevEngagement, false)

  const topPost = postsData.sort((a, b) => (b.reach ?? 0) - (a.reach ?? 0))[0] ?? null

  const weekLabel = `${new Date(week_start).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })} – ${new Date(week_end).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}`

  const narrative = await generateReportNarrative(
    client.business_name,
    {
      posts: postsData.length,
      reach: totalReach,
      likes: totalLikes,
      saves: totalSaves,
      engagement: avgEngagement ?? 0,
    },
    weekLabel,
    churn.level,
    churn.factors,
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: report } = await (supabase as any)
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
      engagement_change_pct: churn.engagementChangePct != null
        ? Number(churn.engagementChangePct.toFixed(2))
        : null,
      churn_risk_level: churn.level,
      churn_risk_factors: churn.factors,
      executive_narrative: narrative.executive_narrative,
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
