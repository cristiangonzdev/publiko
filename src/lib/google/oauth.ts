// Google OAuth helper: refresh access token desde un refresh token guardado.
// Cache in-memory por refresh_token para no pedir token nuevo en cada llamada
// dentro de la misma invocación serverless.

interface CachedToken {
  accessToken: string
  expiresAt: number
}

const cache = new Map<string, CachedToken>()

export async function getGoogleAccessToken(refreshToken: string): Promise<string> {
  const cached = cache.get(refreshToken)
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.accessToken
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET no configurados')
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  const data = (await res.json()) as {
    access_token?: string
    expires_in?: number
    error?: string
    error_description?: string
  }

  if (!res.ok || !data.access_token) {
    throw new Error(`Google OAuth failed: ${data.error_description ?? data.error ?? 'unknown'}`)
  }

  const accessToken = data.access_token
  const expiresAt = Date.now() + (data.expires_in ?? 3600) * 1000
  cache.set(refreshToken, { accessToken, expiresAt })
  return accessToken
}
