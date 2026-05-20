const GRAPH = 'https://graph.facebook.com/v21.0'

export interface MetaPublishPayload {
  igAccountId: string
  systemUserToken: string
  mediaUrl: string
  mimeType: string
  caption: string
  platform: 'instagram' | 'facebook'
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
  const mediaType = isVideo ? 'REELS' : 'IMAGE'

  const containerBody: Record<string, unknown> = {
    caption: payload.caption,
    media_type: mediaType,
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

  if (isVideo) {
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
    external_url: `https://www.instagram.com/p/${publish.id}/`,
  }
}

export async function publishToFacebook(
  pageId: string,
  token: string,
  mediaUrl: string,
  mimeType: string,
  caption: string,
): Promise<MetaPublishResult> {
  const isVideo = mimeType.startsWith('video/')
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
