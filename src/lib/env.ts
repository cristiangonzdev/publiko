import { z } from 'zod'

/**
 * Server-only environment schema (only ever imported from server code — it
 * reads private vars). Validated lazily on first access so a missing variable
 * fails fast with a clear message instead of producing `undefined` deep inside
 * an integration call.
 */
const serverSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url(),

  // Integrations — required only when that feature runs; validated on access.
  META_APP_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REFRESH_TOKEN: z.string().optional(),
  GOOGLE_REFRESH_TOKEN_GMB: z.string().optional(),
  GOOGLE_DRIVE_ROOT_FOLDER_ID: z.string().optional(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_ADMIN_CHAT_ID: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM: z.string().optional(),
  CRON_SECRET: z.string().min(1),
  WEBHOOK_SECRET: z.string().min(1),
})

export type ServerEnv = z.infer<typeof serverSchema>

let cached: ServerEnv | null = null

export function getEnv(): ServerEnv {
  if (cached) return cached
  const parsed = serverSchema.safeParse(process.env)
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join('.')).join(', ')
    throw new Error(`Variables de entorno inválidas o ausentes: ${missing}`)
  }
  cached = parsed.data
  return cached
}

/** Require a specific optional integration var, throwing a clear error if absent. */
export function requireEnv(key: keyof ServerEnv): string {
  const value = process.env[key]
  if (!value) throw new Error(`Variable de entorno requerida ausente: ${key}`)
  return value
}
