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
  followers = 0,
): Promise<PostInsights | null> {
  try {
    // Nombres de métrica VÁLIDOS de IG media insights. Tanto feed como reels
    // soportan este set; pedir nombres inventados (likes_count, …) hace que la
    // API devuelva error y el harvest se quede a null.
    const metrics = 'reach,likes,comments,shares,saved'

    const data = await graphGet<{
      data: Array<{ name: string; values: Array<{ value: number }> }>
    }>(`${externalPostId}/insights?metric=${metrics}&period=lifetime`, token)

    const values: Record<string, number> = {}
    for (const item of data.data ?? []) {
      values[item.name] = item.values?.[0]?.value ?? 0
    }

    const likes = values.likes ?? 0
    const comments = values.comments ?? 0
    const shares = values.shares ?? 0
    const saves = values.saved ?? 0
    const totalInteractions = likes + comments + shares + saves

    const reach = values.reach ?? 0
    // engagement_rate = interacciones / alcance; si no hay alcance, cae a
    // seguidores como denominador para no perder la señal.
    const denominator = reach > 0 ? reach : followers
    const engagementRate = denominator > 0 ? totalInteractions / denominator : 0

    return {
      reach,
      impressions: values.impressions ?? 0,
      likes,
      comments,
      shares,
      saves,
      engagement_rate: engagementRate,
    }
  } catch (err) {
    console.error('getPostInsights failed', externalPostId, err instanceof Error ? err.message : err)
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
  } catch (err) {
    console.error('getIGFollowerCount failed', igAccountId, err instanceof Error ? err.message : err)
    return null
  }
}
