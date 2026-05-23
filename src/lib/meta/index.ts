const GRAPH = 'https://graph.facebook.com/v21.0'

export type PublishKind = 'feed' | 'story'

export interface MetaPublishPayload {
  igAccountId: string
  systemUserToken: string
  mediaUrl: string
  mimeType: string
  caption: string
  platform: 'instagram' | 'facebook'
  kind?: PublishKind
  facebookPageId?: string
}

export interface MetaPublishResult {
  external_post_id: string
  external_url: string | null
}

async function graphRequest<T>(
  path: string,
  method: 'GET' | 'POST',
  token: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const url = `${GRAPH}/${path}`
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json() as T & { error?: { message: string } }
  if ((json as { error?: { message: string } }).error) {
    throw new Error((json as { error: { message: string } }).error.message)
  }
  return json
}

async function pollContainerStatus(
  containerId: string,
  token: string,
  maxAttempts = 20,
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    const data = await graphRequest<{ status_code: string }>(
      `${containerId}?fields=status_code`,
      'GET',
      token,
    )
    if (data.status_code === 'FINISHED') return
    if (data.status_code === 'ERROR' || data.status_code === 'EXPIRED') {
      throw new Error(`Container failed with status: ${data.status_code}`)
    }
    await new Promise((r) => setTimeout(r, 3000))
  }
  throw new Error('Container processing timeout')
}

export async function publishToInstagram(payload: MetaPublishPayload): Promise<MetaPublishResult> {
  const isVideo = payload.mimeType.startsWith('video/')
  const kind = payload.kind ?? 'feed'
  // STORIES: stories propias de IG (foto o video, 9:16, video ≤60s).
  // REELS: vídeo del feed. IMAGE: foto del feed.
  const mediaType =
    kind === 'story' ? 'STORIES' : (isVideo ? 'REELS' : 'IMAGE')

  // Stories no aceptan caption en el container — IG la ignora silenciosamente
  // pero por limpieza no la enviamos.
  const containerBody: Record<string, unknown> = {
    media_type: mediaType,
  }
  if (kind !== 'story') {
    containerBody.caption = payload.caption
  }

  if (isVideo) {
    containerBody.video_url = payload.mediaUrl
  } else {
    containerBody.image_url = payload.mediaUrl
  }

  const container = await graphRequest<{ id: string }>(
    `${payload.igAccountId}/media`,
    'POST',
    payload.systemUserToken,
    containerBody,
  )

  // Stories de vídeo también requieren polling de estado del container
  if (isVideo || kind === 'story') {
    await pollContainerStatus(container.id, payload.systemUserToken)
  }

  const publish = await graphRequest<{ id: string }>(
    `${payload.igAccountId}/media_publish`,
    'POST',
    payload.systemUserToken,
    { creation_id: container.id },
  )

  return {
    external_post_id: publish.id,
    // Las stories no tienen URL pública estable (caducan en 24h); devolvemos null.
    external_url: kind === 'story' ? null : `https://www.instagram.com/p/${publish.id}/`,
  }
}

export async function publishToFacebook(
  pageId: string,
  token: string,
  mediaUrl: string,
  mimeType: string,
  caption: string,
  kind: PublishKind = 'feed',
): Promise<MetaPublishResult> {
  const isVideo = mimeType.startsWith('video/')

  if (kind === 'story') {
    return publishFacebookStory(pageId, token, mediaUrl, isVideo)
  }

  let postId: string
  if (isVideo) {
    const res = await graphRequest<{ id: string }>(
      `${pageId}/videos`,
      'POST',
      token,
      { file_url: mediaUrl, description: caption },
    )
    postId = res.id
  } else {
    const res = await graphRequest<{ id: string }>(
      `${pageId}/photos`,
      'POST',
      token,
      { url: mediaUrl, caption },
    )
    postId = res.id
  }

  return {
    external_post_id: postId,
    external_url: `https://www.facebook.com/${pageId}/posts/${postId}`,
  }
}

// Facebook Stories:
//  - foto: 2 pasos (upload unpublished photo + /photo_stories con photo_id)
//  - vídeo: 3 fases hosted-file (start → upload con file_url → finish)
async function publishFacebookStory(
  pageId: string,
  token: string,
  mediaUrl: string,
  isVideo: boolean,
): Promise<MetaPublishResult> {
  if (isVideo) {
    return publishFacebookVideoStory(pageId, token, mediaUrl)
  }

  const photo = await graphRequest<{ id: string }>(
    `${pageId}/photos`,
    'POST',
    token,
    { url: mediaUrl, published: false },
  )

  const story = await graphRequest<{ post_id: string }>(
    `${pageId}/photo_stories`,
    'POST',
    token,
    { photo_id: photo.id },
  )

  return {
    external_post_id: story.post_id,
    external_url: null,
  }
}

async function publishFacebookVideoStory(
  pageId: string,
  token: string,
  videoUrl: string,
): Promise<MetaPublishResult> {
  // Fase 1 — start: reservar video_id + upload_url
  const start = await graphRequest<{ video_id: string; upload_url: string }>(
    `${pageId}/video_stories?upload_phase=start`,
    'POST',
    token,
  )

  // Fase 2 — upload hosted: indicamos a Meta la URL pública del vídeo
  const uploadRes = await fetch(start.upload_url, {
    method: 'POST',
    headers: {
      Authorization: `OAuth ${token}`,
      file_url: videoUrl,
    },
  })
  const uploadJson = (await uploadRes.json().catch(() => ({}))) as {
    success?: boolean
    error?: { message: string }
  }
  if (!uploadJson.success) {
    throw new Error(`FB video story upload failed: ${uploadJson.error?.message ?? 'unknown'}`)
  }

  // Fase 3 — finish: publicar como story
  const finish = await graphRequest<{ post_id?: string; success: boolean; error?: { message: string } }>(
    `${pageId}/video_stories?upload_phase=finish&video_id=${start.video_id}&video_state=PUBLISHED`,
    'POST',
    token,
  )

  if (!finish.success) {
    throw new Error(`FB video story finish failed: ${finish.error?.message ?? 'unknown'}`)
  }

  return {
    // post_id no siempre viene en finish; en su defecto guardamos el video_id
    external_post_id: finish.post_id ?? start.video_id,
    external_url: null,
  }
}
