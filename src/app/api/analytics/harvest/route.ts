import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getPostInsights, getIGFollowerCount } from '@/lib/meta/analytics'
import { detectAndMarkWinners } from '@/lib/winning-patterns/detect'

// El harvest itera clientes × posts y llama a Meta por cada post: necesita
// margen amplio de ejecución en Vercel.
export const maxDuration = 300

function authorized(request: NextRequest): boolean {
  const secret = request.headers.get('x-webhook-secret')
  const bearer = request.headers.get('authorization')
  return secret === process.env.WEBHOOK_SECRET || bearer === `Bearer ${process.env.CRON_SECRET}`
}

// Vercel cron invoca con GET + Authorization: Bearer CRON_SECRET.
export async function GET(request: NextRequest) {
  return POST(request)
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // client_id opcional: por body o por query string. Si no se pasa, procesa
  // todos los clientes activos con token (comportamiento original).
  const body = (await request.json().catch(() => ({}))) as { client_id?: string }
  const client_id = body.client_id ?? request.nextUrl.searchParams.get('client_id') ?? undefined
  const supabase = await createServiceClient()

  const clientFilter = client_id
    ? supabase.from('clients').select('id, meta_business_id, meta_system_user_token, current_followers').eq('id', client_id).eq('is_active', true)
    : supabase.from('clients').select('id, meta_business_id, meta_system_user_token, current_followers').eq('is_active', true).not('meta_system_user_token', 'is', null)

  const { data: clients, error: clientsErr } = await clientFilter
  if (clientsErr) return NextResponse.json({ error: clientsErr.message }, { status: 500 })
  if (!clients?.length) return NextResponse.json({ harvested: 0 })

  let harvested = 0
  const winners: Array<{ client_id: string; winners_marked: number; patterns_created: number }> = []
  for (const client of clients) {
    const token = client.meta_system_user_token
    if (!token || !client.meta_business_id) continue

    // Seguidores actuales como denominador de respaldo para el engagement_rate.
    const currentFollowers = (client.current_followers as Record<string, number>) ?? {}
    const igFollowers = currentFollowers.instagram ?? 0

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: posts, error: postsErr } = await supabase
      .from('posts')
      .select('id, external_post_id, platform, published_at')
      .eq('client_id', client.id)
      .eq('status', 'published')
      .not('external_post_id', 'is', null)
      .gte('published_at', oneWeekAgo)

    if (postsErr) {
      console.error('harvest: error cargando posts del cliente', client.id, postsErr.message)
      continue
    }

    // Paraleliza las llamadas a Meta por post (paralelismo moderado tolerado).
    const targets = (posts ?? []).filter(
      (p): p is typeof p & { external_post_id: string } => !!p.external_post_id,
    )
    const insightsResults = await Promise.allSettled(
      targets.map(async (post) => {
        // El set de métricas pedido es válido para feed y reels, así que no
        // hace falta distinguir el tipo aquí (la columna platform no lo indica).
        const insights = await getPostInsights(post.external_post_id, token, false, igFollowers)
        return { post, insights }
      }),
    )

    for (const result of insightsResults) {
      if (result.status === 'rejected') {
        console.error('harvest: getPostInsights rechazado', result.reason)
        continue
      }
      const { post, insights } = result.value
      if (!insights) continue

      const { error: updateErr } = await supabase
        .from('posts')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update({
          ...insights,
          metrics_updated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', post.id)

      if (updateErr) {
        console.error('harvest: error actualizando métricas del post', post.id, updateErr.message)
        continue
      }
      harvested++
    }

    if (client.meta_business_id) {
      const followerCount = await getIGFollowerCount(client.meta_business_id, token)
      if (followerCount !== null) {
        const { error: followersErr } = await supabase
          .from('clients')
          .update({
            current_followers: { ...currentFollowers, instagram: followerCount },
            updated_at: new Date().toISOString(),
          })
          .eq('id', client.id)
        if (followersErr) {
          console.error('harvest: error actualizando seguidores', client.id, followersErr.message)
        }
      }
    }

    try {
      const result = await detectAndMarkWinners(supabase, client.id)
      if (result.winners_marked > 0) {
        winners.push({
          client_id: client.id,
          winners_marked: result.winners_marked,
          patterns_created: result.patterns_created,
        })
      }
    } catch (err) {
      console.error('detectAndMarkWinners failed for client', client.id, err)
    }
  }

  return NextResponse.json({ harvested, winners })
}
