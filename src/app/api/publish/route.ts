import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { publishToInstagram, publishToFacebook } from '@/lib/meta'
import { publishLocalPost } from '@/lib/gmb'
import { createSignedDownloadUrl } from '@/lib/upload/signed-download'
import { notifyAdmin, TG } from '@/lib/telegram'
import type { PostToPublish } from '@/types/supabase'

export const runtime = 'nodejs'
export const maxDuration = 300

const BACKOFF_MINUTES = [15, 60, 240]
const MAX_RETRIES = 3
const BATCH_SIZE = 20

type Svc = Awaited<ReturnType<typeof createServiceClient>>

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-webhook-secret')
  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createServiceClient()

  // Claim atómico: marca los posts como 'publishing' (FOR UPDATE SKIP LOCKED)
  // para que dos ejecuciones del cron nunca publiquen el mismo post dos veces.
  const { data: claimed, error: claimError } = await supabase.rpc('claim_posts_to_publish', { batch_size: BATCH_SIZE })
  if (claimError) {
    return NextResponse.json({ error: claimError.message }, { status: 500 })
  }
  const posts = (claimed ?? []) as PostToPublish[]
  if (posts.length === 0) return NextResponse.json({ published: 0 })

  const results = await Promise.allSettled(posts.map((post) => publishOne(supabase, post)))

  const published = results.filter((r) => r.status === 'fulfilled').length
  const failed = results.filter((r) => r.status === 'rejected').length

  // Telegram: un único resumen por tick (evita el rate limit de ~30 msg/s
  // cuando hay muchos posts a la vez). Los fallos definitivos sí se avisan 1 a 1.
  if (published > 0 || failed > 0) {
    await notifyAdmin(`📤 <b>Publicación</b>\n\n✅ ${published} publicados · ⚠️ ${failed} con error`)
  }

  return NextResponse.json({ published, failed })
}

async function publishOne(supabase: Svc, post: PostToPublish): Promise<{ post_id: string; status: string }> {
  const { post_id, platform, content_type, copy, hashtags, asset_id, meta_system_user_token, meta_business_id, facebook_page_id } = post
  const currentAttempt = (post.attempts_made ?? 0) + 1

  try {
    const { data: asset } = await supabase
      .from('assets')
      .select('storage_path, file_type')
      .eq('id', asset_id)
      .single()

    if (!asset?.storage_path) throw new Error('Asset no encontrado')

    // El bucket es privado: firmamos una URL temporal para que Meta descargue el media.
    const mediaUrl = await createSignedDownloadUrl(asset.storage_path, 7200)
    if (!mediaUrl) throw new Error('No se pudo firmar la URL del asset')

    const kind: 'feed' | 'story' = content_type === 'story' ? 'story' : 'feed'
    const caption = hashtags?.length ? `${copy}\n\n${hashtags.map((h) => `#${h}`).join(' ')}` : copy

    let result
    if (platform === 'instagram') {
      result = await publishToInstagram({
        igAccountId: meta_business_id,
        systemUserToken: meta_system_user_token,
        mediaUrl,
        mimeType: asset.file_type,
        caption,
        platform: 'instagram',
        kind,
      })
    } else if (platform === 'facebook') {
      const fbPageId = facebook_page_id || meta_business_id
      if (!fbPageId) throw new Error('Cliente sin Facebook Page ID configurado')
      result = await publishToFacebook(fbPageId, meta_system_user_token, mediaUrl, asset.file_type, caption, kind)
    } else if (platform === 'gmb') {
      const { data: postWithClient } = await supabase
        .from('posts')
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
        mediaUrl: asset.file_type.startsWith('image/') ? mediaUrl : undefined,
      })
    } else {
      throw new Error(`Plataforma ${platform} aún no soportada`)
    }

    const { error: updateError } = await supabase
      .from('posts')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
        external_post_id: result.external_post_id,
        external_url: result.external_url,
        scheduled_retry_at: null,
        last_attempt_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', post_id)

    // Si Meta publicó pero el update falló, alertamos: el post quedó en 'publishing'
    // y NO se reintentará (evita doble publicación). Requiere intervención manual.
    if (updateError) {
      await notifyAdmin(`🚨 <b>Post publicado en Meta pero falló el guardado</b>\n\npost_id=${post_id}\nexternal_id=${result.external_post_id}\n${updateError.message}\n\nRevisar a mano para no republicar.`)
      throw updateError
    }

    // Marca la tarea como publicada (la primera plataforma que publica)
    const { data: postRow } = await supabase
      .from('posts')
      .select('task_id, clients!inner(business_name), content_tasks!inner(title)')
      .eq('id', post_id)
      .single()

    if (postRow?.task_id) {
      await supabase
        .from('content_tasks')
        .update({ status: 'published', published_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', postRow.task_id)
    }

    return { post_id, status: 'published' }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    await handleFailure(supabase, post_id, currentAttempt, reason)
    throw err
  }
}

async function handleFailure(supabase: Svc, postId: string, attempt: number, reason: string) {
  if (attempt < MAX_RETRIES) {
    const minutesUntilRetry = BACKOFF_MINUTES[attempt - 1] ?? 240
    const nextRetryAt = new Date(Date.now() + minutesUntilRetry * 60 * 1000).toISOString()

    // Vuelve a 'scheduled' (estaba 'publishing' por el claim) para que el
    // próximo claim lo recoja tras el backoff.
    await supabase
      .from('posts')
      .update({
        status: 'scheduled',
        retry_count: attempt,
        failure_reason: reason,
        failed_at: new Date().toISOString(),
        last_attempt_at: new Date().toISOString(),
        scheduled_retry_at: nextRetryAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', postId)

    console.warn(`[publish] retry ${attempt}/${MAX_RETRIES} for post ${postId} in ${minutesUntilRetry}min — ${reason}`)
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

    const { data: postRow } = await supabase
      .from('posts')
      .select('clients!inner(business_name), content_tasks!inner(title)')
      .eq('id', postId)
      .single()
    const businessName = (postRow?.clients as unknown as { business_name: string } | null)?.business_name ?? ''
    const taskTitle = (postRow?.content_tasks as unknown as { title: string } | null)?.title ?? ''
    console.error(`[publish] DEFINITIVE failure for post ${postId} — ${reason}`)
    await notifyAdmin(TG.falloDefinitivo(businessName, taskTitle, reason))
  }
}
