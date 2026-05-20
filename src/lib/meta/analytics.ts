const GRAPH = 'https://graph.facebook.com/v21.0'

interface PostInsights {
  reach: number
  impressions: number
  likes: number
  comments: number
  shares: number
  saves: number
  engagement_rate: number
}

async function graphGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${GRAPH}/${path}&access_token=${token}`)
  const json = await res.json() as T & { error?: { message: string } }
  if ((json as { error?: { message: string } }).error) {
    throw new Error((json as { error: { message: string } }).error.message)
  }
  return json
}

export async function getPostInsights(
  externalPostId: string,
  token: string,
  isVideo = false,
): Promise<PostInsights | null> {
  try {
    const metrics = isVideo
      ? 'reach,impressions,plays,comments,shares,saved'
      : 'reach,impressions,likes_count,comments_count,shares_count,saved'

    const data = await graphGet<{
      data: Array<{ name: string; values: Array<{ value: number }> }>
    }>(`${externalPostId}/insights?metric=${metrics}&period=lifetime`, token)

    const values: Record<string, number> = {}
    for (const item of data.data ?? []) {
      values[item.name] = item.values?.[0]?.value ?? 0
    }

    const totalInteractions =
      (values.likes_count ?? 0) +
      (values.comments_count ?? values.comments ?? 0) +
      (values.saved ?? 0)

    const reach = values.reach ?? 0
    const engagementRate = reach > 0 ? totalInteractions / reach : 0

    return {
      reach,
      impressions: values.impressions ?? 0,
      likes: values.likes_count ?? 0,
      comments: values.comments_count ?? values.comments ?? 0,
      shares: values.shares_count ?? values.shares ?? 0,
      saves: values.saved ?? 0,
      engagement_rate: engagementRate,
    }
  } catch {
    return null
  }
}

export async function getIGFollowerCount(
  igAccountId: string,
  token: string,
): Promise<number | null> {
  try {
    const data = await graphGet<{ followers_count: number }>(
      `${igAccountId}?fields=followers_count`,
      token,
    )
    return data.followers_count ?? null
  } catch {
    return null
  }
}
