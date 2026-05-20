import type { Metadata } from 'next'

import './globals.css'

export const metadata: Metadata = {
  title: 'Agency OS',
  description: 'Sistema operativo para agencias de redes sociales.',
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
