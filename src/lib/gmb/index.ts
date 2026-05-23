import { getGoogleAccessToken } from '@/lib/google/oauth'

const GMB_BASE = 'https://mybusiness.googleapis.com/v4'

function refreshToken(): string {
  const t = process.env.GOOGLE_REFRESH_TOKEN_GMB
  if (!t) throw new Error('GOOGLE_REFRESH_TOKEN_GMB no configurado')
  return t
}

async function gmbFetch<T>(
  path: string,
  init: { method?: string; body?: Record<string, unknown> } = {},
): Promise<T> {
  const accessToken = await getGoogleAccessToken(refreshToken())
  const res = await fetch(`${GMB_BASE}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  })
  const json = (await res.json().catch(() => ({}))) as T & { error?: { message: string } }
  if (!res.ok || (json as { error?: { message: string } }).error) {
    const msg = (json as { error?: { message: string } }).error?.message ?? `HTTP ${res.status}`
    throw new Error(`GMB API: ${msg}`)
  }
  return json as T
}

export interface GmbPostResult {
  external_post_id: string
  external_url: string | null
}

export async function publishLocalPost(params: {
  accountId: string
  locationId: string
  summary: string
  mediaUrl?: string
  ctaType?: 'CALL' | 'ORDER' | 'BOOK' | 'LEARN_MORE' | 'SHOP' | 'SIGN_UP'
  ctaUrl?: string
}): Promise<GmbPostResult> {
  const body: Record<string, unknown> = {
    languageCode: 'es',
    summary: params.summary,
    topicType: 'STANDARD',
  }

  if (params.mediaUrl) {
    body.media = [{ mediaFormat: 'PHOTO', sourceUrl: params.mediaUrl }]
  }

  if (params.ctaType && params.ctaUrl) {
    body.callToAction = { actionType: params.ctaType, url: params.ctaUrl }
  }

  const created = await gmbFetch<{ name: string; searchUrl?: string }>(
    `/accounts/${params.accountId}/locations/${params.locationId}/localPosts`,
    { method: 'POST', body },
  )

  return {
    external_post_id: created.name,
    external_url: created.searchUrl ?? null,
  }
}

export interface GmbReview {
  name: string
  reviewId: string
  reviewer: { profilePhotoUrl?: string; displayName?: string }
  starRating: 'STAR_RATING_UNSPECIFIED' | 'ONE' | 'TWO' | 'THREE' | 'FOUR' | 'FIVE'
  comment?: string
  createTime: string
  reviewReply?: { comment: string; updateTime: string }
}

const STAR_TO_NUM: Record<string, number> = {
  ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5,
}

export function reviewStarsToNumber(stars: GmbReview['starRating']): number {
  return STAR_TO_NUM[stars] ?? 0
}

export async function fetchReviews(params: {
  accountId: string
  locationId: string
  pageSize?: number
}): Promise<GmbReview[]> {
  const data = await gmbFetch<{ reviews?: GmbReview[]; averageRating?: number; totalReviewCount?: number }>(
    `/accounts/${params.accountId}/locations/${params.locationId}/reviews?pageSize=${params.pageSize ?? 50}`,
  )
  return data.reviews ?? []
}

export async function replyReview(params: {
  accountId: string
  locationId: string
  reviewId: string
  comment: string
}): Promise<void> {
  await gmbFetch(
    `/accounts/${params.accountId}/locations/${params.locationId}/reviews/${params.reviewId}/reply`,
    { method: 'PUT', body: { comment: params.comment } },
  )
}
