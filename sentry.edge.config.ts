import * as Sentry from '@sentry/nextjs'

// Gated por DSN (ver sentry.server.config.ts).
const dsn = process.env.SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    enabled: process.env.NODE_ENV === 'production',
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  })
}
