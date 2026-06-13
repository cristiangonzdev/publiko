export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config')
  }
}

// Sin DSN configurado no hay cliente activo, así que captureRequestError es no-op.
export { captureRequestError as onRequestError } from '@sentry/nextjs'
