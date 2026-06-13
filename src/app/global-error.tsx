'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    // No-op sin DSN configurado.
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="es">
      <body className="flex min-h-screen items-center justify-center bg-ink-50 p-8 text-center">
        <div>
          <h2 className="font-serif text-2xl text-ink-900">Algo ha fallado</h2>
          <p className="mt-2 text-sm text-ink-500">Recarga la página o vuelve a intentarlo en un momento.</p>
        </div>
      </body>
    </html>
  )
}
