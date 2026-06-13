import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'

/**
 * Punto único de registro de errores. Escribe a la consola estructurada
 * (visible en los logs de Vercel) y reporta a Sentry. Sin DSN configurado,
 * `Sentry.captureException` no tiene cliente activo y es un no-op seguro.
 */
export function logError(context: string, error: unknown, extra?: Record<string, unknown>) {
  const message = error instanceof Error ? error.message : String(error)
  const stack = error instanceof Error ? error.stack : undefined
  console.error(`[${context}] ${message}`, { ...extra, stack })
  Sentry.captureException(error, { tags: { context }, extra })
}

/**
 * Envuelve un route handler para registrar y normalizar errores no capturados
 * en un `{ error }` con status 500, en vez de un 500 opaco de Next sin log.
 */
export function withErrorHandler<Args extends unknown[]>(
  context: string,
  handler: (...args: Args) => Promise<NextResponse>,
): (...args: Args) => Promise<NextResponse> {
  return async (...args: Args) => {
    try {
      return await handler(...args)
    } catch (error) {
      logError(context, error)
      return NextResponse.json({ error: 'Error interno' }, { status: 500 })
    }
  }
}
