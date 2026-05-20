import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getPostInsights, getIGFollowerCount } from '@/lib/meta/analytics'

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-webhook-secret')
  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { client_id } = await request.json() as { client_id?: string }
  const supabase = await createServiceClient()

  const clientFilter = client_id
    ? supabase.from('clients').select('id, meta_business_id, meta_system_user_token, current_followers').eq('id', client_id).eq('is_active', true)
    : supabase.from('clients').select('id, meta_business_id, meta_system_user_token, current_followers').eq('is_active', true).not('meta_system_user_token', 'is', null)

  const { data: clients } = await clientFilter
  if (!clients?.length) return NextResponse.json({ harvested: 0 })

  let harvested = 0
  for (const client of clients) {
    const token = client.meta_system_user_token
    if (!token || !client.meta_business_id) continue

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: posts } = await supabase
      .from('posts')
      .select('id, external_post_id, platform, published_at')
      .eq('client_id', client.id)
      .eq('status', 'published')
      .not('external_post_id', 'is', null)
      .gte('published_at', oneWeekAgo)

    for (const post of posts ?? []) {
      if (!post.external_post_id) continue
      const insights = await getPostInsights(post.external_post_id, token)
      if (!insights) continue

      await supabase
        .from('posts')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update({
          ...insights,
          metrics_updated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', post.id)

      harvested++
    }

    if (client.meta_business_id) {
      const followerCount = await getIGFollowerCount(client.meta_business_id, token)
      if (followerCount !== null) {
        const currentFollowers = (client.current_followers as Record<string, number>) ?? {}
        await supabase
          .from('clients')
          .update({
            current_followers: { ...currentFollowers, instagram: followerCount },
            updated_at: new Date().toISOString(),
          })
          .eq('id', client.id)
      }
    }
  }

  return NextResponse.json({ harvested })
}
