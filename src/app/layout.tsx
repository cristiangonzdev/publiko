import type { Metadata } from 'next'
import { Toaster } from 'sonner'

import './globals.css'

export const metadata: Metadata = {
  title: 'Agency OS',
  description: 'Sistema operativo para agencias de redes sociales.',
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        {children}
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  )
}
