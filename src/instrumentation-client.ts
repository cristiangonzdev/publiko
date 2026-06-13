import * as Sentry from '@sentry/nextjs'

// Gated por DSN público: sin NEXT_PUBLIC_SENTRY_DSN no se inicializa nada.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    enabled: process.env.NODE_ENV === 'production',
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
  })
}

// Requerido por Next 16 para instrumentar las transiciones de router (silencia el warning).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
