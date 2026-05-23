import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { publishToInstagram, publishToFacebook } from '@/lib/meta'
import { publishLocalPost } from '@/lib/gmb'
import { notifyAdmin, TG } from '@/lib/telegram'

const BACKOFF_MINUTES = [15, 60, 240]
const MAX_RETRIES = 3

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-webhook-secret')
  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createServiceClient()

  const { data: posts } = await supabase.rpc('get_posts_to_publish')
  if (!posts || posts.length === 0) return NextResponse.json({ published: 0 })

  const results = await Promise.allSettled(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (posts as any[]).map(async (post: { post_id: string; platform: string; content_type?: string | null; copy: string; hashtags: string[] | null; asset_id: string; meta_system_user_token: string; meta_business_id: string; attempts_made?: number }) => {
      const { post_id, platform, content_type, copy, hashtags, asset_id, meta_system_user_token, meta_business_id } = post
      const currentAttempt = (post.attempts_made ?? 0) + 1

      try {
        const { data: asset } = await supabase
          .from('assets')
          .select('public_url, file_type')
          .eq('id', asset_id)
          .single()

        if (!asset?.public_url) throw new Error('Asset not found')

        const kind: 'feed' | 'story' = content_type === 'story' ? 'story' : 'feed'

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
            kind,
          })
        } else if (platform === 'facebook') {
          result = await publishToFacebook(
            meta_business_id,
            meta_system_user_token,
            asset.public_url,
            asset.file_type,
            caption,
            kind,
          )
        } else if (platform === 'gmb') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: postWithClient } = await (supabase.from('posts') as any)
            .select('clients!inner(gmb_account_id, gmb_location_id)')
            .eq('id', post_id)
            .single() as { data: { clients: { gmb_account_id: string | null; gmb_location_id: string | null } } | null }

          const gmb = postWithClient?.clients
          if (!gmb?.gmb_account_id || !gmb?.gmb_location_id) {
            throw new Error('Cliente sin gmb_account_id/gmb_location_id configurados')
          }

          result = await publishLocalPost({
            accountId: gmb.gmb_account_id,
            locationId: gmb.gmb_location_id,
            summary: caption,
            mediaUrl: asset.file_type.startsWith('image/') ? asset.public_url : undefined,
          })
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
            scheduled_retry_at: null,
            last_attempt_at: new Date().toISOString(),
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
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err)
        await handleFailure(supabase, post_id, currentAttempt, reason)
        throw err
      }
    })
  )

  const published = results.filter((r) => r.status === 'fulfilled').length
  const failed = results.filter((r) => r.status === 'rejected').length

  return NextResponse.json({ published, failed })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleFailure(supabase: any, postId: string, attempt: number, reason: string) {
  // Cargar contexto para notificar
  const { data: postRow } = await supabase
    .from('posts')
    .select('clients!inner(business_name), content_tasks!inner(title)')
    .eq('id', postId)
    .single()
  const businessName = (postRow?.clients as { business_name: string } | null)?.business_name ?? ''
  const taskTitle = (postRow?.content_tasks as { title: string } | null)?.title ?? ''

  if (attempt < MAX_RETRIES) {
    const minutesUntilRetry = BACKOFF_MINUTES[attempt - 1] ?? 240
    const nextRetryAt = new Date(Date.now() + minutesUntilRetry * 60 * 1000).toISOString()

    await supabase
      .from('posts')
      .update({
        retry_count: attempt,
        failure_reason: reason,
        failed_at: new Date().toISOString(),
        last_attempt_at: new Date().toISOString(),
        scheduled_retry_at: nextRetryAt,
        // status SIGUE en 'scheduled' para que la próxima vuelta del cron lo recoja
        updated_at: new Date().toISOString(),
      })
      .eq('id', postId)

    console.warn(`[publish] retry ${attempt}/${MAX_RETRIES} for post ${postId} in ${minutesUntilRetry}min — ${reason}`)
    await notifyAdmin(TG.reintento(businessName, taskTitle, attempt, minutesUntilRetry, reason))
  } else {
    await supabase
      .from('posts')
      .update({
        status: 'failed',
        retry_count: attempt,
        failure_reason: reason,
        failed_at: new Date().toISOString(),
        last_attempt_at: new Date().toISOString(),
        scheduled_retry_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', postId)

    console.error(`[publish] DEFINITIVE failure for post ${postId} — ${reason}`)
    await notifyAdmin(TG.falloDefinitivo(businessName, taskTitle, reason))
  }
}
