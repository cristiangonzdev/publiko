# Skill: Meta Graph API — publicación y reintentos

Guía para publicar en Instagram y Facebook y gestionar el ciclo de reintentos. La implementación vive en `src/lib/meta/index.ts`. El cron de publicación está en `src/app/api/cron/publish-retry/route.ts`.

---

## Credenciales (nunca hardcodeadas)

Las credenciales son por cliente, no globales:
```typescript
// Siempre vienen de la tabla clients, nunca de env vars
const { meta_system_user_token, meta_business_id, facebook_page_id } = client
```

La RPC `get_posts_to_publish()` ya devuelve estas credenciales junto a cada post.

---

## Flujo de publicación en Instagram

Meta Graph API requiere un proceso de 3 pasos para Instagram:

```typescript
const BASE = 'https://graph.facebook.com/v21.0'

async function publishToInstagram(igAccountId: string, token: string, mediaUrl: string, caption: string) {
  // Paso 1: Crear container de media
  const containerRes = await fetch(
    `${BASE}/${igAccountId}/media?image_url=${encodeURIComponent(mediaUrl)}&caption=${encodeURIComponent(caption)}&access_token=${token}`,
    { method: 'POST' }
  )
  const { id: containerId } = await containerRes.json()

  // Paso 2: Esperar a que el container esté listo (polling)
  let status = 'IN_PROGRESS'
  let polls = 0
  while (status !== 'FINISHED' && polls < 20) {
    await new Promise(r => setTimeout(r, 3000))
    const statusRes = await fetch(
      `${BASE}/${containerId}?fields=status_code&access_token=${token}`
    )
    const { status_code } = await statusRes.json()
    status = status_code
    polls++
  }
  if (status !== 'FINISHED') throw new Error(`Container no llegó a FINISHED: ${status}`)

  // Paso 3: Publicar
  const publishRes = await fetch(
    `${BASE}/${igAccountId}/media_publish?creation_id=${containerId}&access_token=${token}`,
    { method: 'POST' }
  )
  const { id: postId } = await publishRes.json()
  return postId  // external_post_id para guardar en posts table
}
```

Para vídeos (reels), el `image_url` se reemplaza por `video_url` y el proceso es similar pero el tiempo de procesado es mayor.

---

## Flujo de publicación en Facebook

```typescript
async function publishToFacebook(
  pageId: string,
  token: string,
  mediaUrl: string,
  mimeType: string,  // 'video/mp4' | 'image/jpeg' | etc.
  caption: string
) {
  const isVideo = mimeType.startsWith('video/')
  const endpoint = isVideo ? 'videos' : 'photos'

  const body = new FormData()
  body.append('access_token', token)
  body.append('message', caption)
  if (isVideo) body.append('file_url', mediaUrl)
  else body.append('url', mediaUrl)

  const res = await fetch(`${BASE}/${pageId}/${endpoint}`, {
    method: 'POST',
    body
  })
  const data = await res.json()
  if (data.error) throw new Error(`Meta API error: ${data.error.message}`)
  return data.id  // external_post_id
}
```

---

## Backoff exponencial — implementación

El cron `publish-retry` implementa 3 reintentos con backoff:

```typescript
const BACKOFF_MINUTES = [15, 60, 240]  // 15min, 1h, 4h

// Al fallar un intento:
const newRetryCount = post.retry_count + 1

if (newRetryCount >= 3) {
  // Marcar como fallido definitivamente
  await supabase.from('posts').update({
    status: 'failed',
    failure_reason: error.message,
    last_attempt_at: new Date().toISOString()
  }).eq('id', post.post_id)

  await notifyAdmin(`🚨 PUBLICACIÓN ABORTADA tras 3 intentos: ${post.post_id}`)
} else {
  // Programar reintento
  const retryAt = new Date(Date.now() + BACKOFF_MINUTES[newRetryCount - 1] * 60 * 1000)
  await supabase.from('posts').update({
    retry_count: newRetryCount,
    scheduled_retry_at: retryAt.toISOString(),
    last_attempt_at: new Date().toISOString()
  }).eq('id', post.post_id)

  await notifyAdmin(`⚠️ Publicación falló (intento ${newRetryCount}/3). Reintentando en ${BACKOFF_MINUTES[newRetryCount - 1]}min`)
}
```

Al tener éxito:
```typescript
await supabase.from('posts').update({
  status: 'published',
  external_post_id: postId,
  external_url: `https://www.instagram.com/p/${postId}/`,
  published_at: new Date().toISOString(),
  retry_count: post.attempts_made,
  scheduled_retry_at: null
}).eq('id', post.post_id)

await notifyAdmin(`✅ Publicado: ${post.post_id} en ${post.platform}`)
```

---

## RPC `get_posts_to_publish()`

Esta RPC (definida en `0006_publish_retries.sql`) devuelve los posts que toca publicar en este ciclo del cron:

```sql
WHERE status = 'scheduled'
  AND (
    (scheduled_at <= now() AND scheduled_retry_at IS NULL)
    OR (scheduled_retry_at IS NOT NULL AND scheduled_retry_at <= now() AND retry_count < 3)
  )
```

Devuelve: `post_id, client_id, platform, content_type, copy, hashtags[], asset_id, meta_system_user_token, meta_business_id, attempts_made`

El campo `facebook_page_id` se añadió en `0009_facebook_page_id.sql` — verificar que la RPC también lo devuelve si se necesita para FB.

---

## Descargar el asset antes de publicar

Los assets están en Supabase Storage (privado). Antes de enviar a Meta API, hay que obtener una URL temporal:

```typescript
const supabase = createServiceClient()
const { data: signedUrlData } = await supabase.storage
  .from('assets')
  .createSignedUrl(asset.storage_path, 300)  // 5 minutos, suficiente para publicar

if (!signedUrlData?.signedUrl) throw new Error('No se pudo obtener signed URL del asset')

await publishToInstagram(igAccountId, token, signedUrlData.signedUrl, copy)
```

---

## Errores comunes de Meta API

| Error | Causa | Solución |
|-------|-------|---------|
| `#200 Permissions error` | Token sin permiso `publish_to_groups` o `pages_manage_posts` | Revisar permisos del System User en Meta Business Manager |
| `#100 Invalid parameter` | `media_url` no es HTTPS o no accesible por Meta | Verificar que la signed URL es pública temporalmente |
| `#368 Policy violation` | Contenido infringe políticas de Meta | Revisar copy y imagen antes de reintentar |
| Container stuck in `ERROR` | Vídeo con formato incorrecto | Verificar spec: H.264, AAC, relación de aspecto válida |

---

## Google Business Profile (GMB)

Módulo: `src/lib/gmb/index.ts`

```typescript
async function publishLocalPost(accountId: string, locationId: string, summary: string, mediaUrl?: string) {
  // Usa googleapis con OAuth2 refresh token
  // POST https://mybusiness.googleapis.com/v4/accounts/{accountId}/locations/{locationId}/localPosts
}
```

El token de Google se obtiene via `src/lib/google/oauth.ts` con el `GOOGLE_REFRESH_TOKEN`. El token de acceso expira cada hora — el cliente de googleapis lo renueva automáticamente.
