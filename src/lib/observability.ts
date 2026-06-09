import { NextResponse } from 'next/server'

/**
 * Punto único de registro de errores. Hoy escribe a la consola estructurada
 * (visible en los logs de Vercel). Cuando se configure el DSN de Sentry, basta
 * con enviar aquí `Sentry.captureException` — el resto del código ya llama a
 * logError, no a console.error suelto.
 */
export function logError(context: string, error: unknown, extra?: Record<string, unknown>) {
  const message = error instanceof Error ? error.message : String(error)
  const stack = error instanceof Error ? error.stack : undefined
  console.error(`[${context}] ${message}`, { ...extra, stack })
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
