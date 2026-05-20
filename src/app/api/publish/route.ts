import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { publishToInstagram, publishToFacebook } from '@/lib/meta'
import { notifyAdmin, TG } from '@/lib/telegram'

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-webhook-secret')
  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createServiceClient()

  const { data: posts } = await supabase.rpc('get_posts_to_publish')
  if (!posts || posts.length === 0) return NextResponse.json({ published: 0 })

  const results = await Promise.allSettled(
    posts.map(async (post) => {
      const { post_id, platform, copy, hashtags, asset_id, meta_system_user_token, meta_business_id } = post

      const { data: asset } = await supabase
        .from('assets')
        .select('public_url, file_type')
        .eq('id', asset_id)
        .single()

      if (!asset?.public_url) throw new Error('Asset not found')

      const caption = hashtags?.length
        ? `${copy}\n\n${hashtags.map((h: string) => `#${h}`).join(' ')}`
        : copy

      let result
      if (platform === 'instagram') {
        result = await publishToInstagram({
          igAccountId: meta_business_id,
          systemUserToken: meta_system_user_token,
          mediaUrl: asset.public_url,
          mimeType: asset.file_type,
          caption,
          platform: 'instagram',
        })
      } else if (platform === 'facebook') {
        result = await publishToFacebook(
          meta_business_id,
          meta_system_user_token,
          asset.public_url,
          asset.file_type,
          caption,
        )
      } else {
        throw new Error(`Platform ${platform} not yet supported`)
      }

      await supabase
        .from('posts')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update({
          status: 'published',
          published_at: new Date().toISOString(),
          external_post_id: result.external_post_id,
          external_url: result.external_url,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', post_id)

      const { data: postRow } = await supabase
        .from('posts')
        .select('task_id, clients!inner(business_name), content_tasks!inner(title)')
        .eq('id', post_id)
        .single()

      if (postRow?.task_id) {
        await supabase
          .from('content_tasks')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .update({ status: 'published', published_at: new Date().toISOString(), updated_at: new Date().toISOString() } as any)
          .eq('id', postRow.task_id)
      }

      const businessName = (postRow?.clients as unknown as { business_name: string })?.business_name ?? ''
      const taskTitle = (postRow?.content_tasks as unknown as { title: string })?.title ?? ''
      await notifyAdmin(TG.publicado(businessName, taskTitle))

      return { post_id, status: 'published' }
    })
  )

  const published = results.filter((r) => r.status === 'fulfilled').length
  const failed = results.filter((r) => r.status === 'rejected')

  for (const f of failed) {
    if (f.status === 'rejected') {
      console.error('Publish failed:', f.reason)
    }
  }

  return NextResponse.json({ published, failed: failed.length })
}
