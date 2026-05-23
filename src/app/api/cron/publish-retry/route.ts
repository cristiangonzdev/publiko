import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 120
export const dynamic = 'force-dynamic'

// Llama internamente al endpoint de publish para procesar tanto los posts
// scheduled normales como los que toca reintentar (la función SQL get_posts_to_publish
// devuelve ambos casos). Se ejecuta cada 15 minutos vía Vercel cron.
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const webhookSecret = process.env.WEBHOOK_SECRET
  if (!webhookSecret) {
    return NextResponse.json({ error: 'WEBHOOK_SECRET not configured' }, { status: 500 })
  }

  const res = await fetch(`${baseUrl}/api/publish`, {
    method: 'POST',
    headers: { 'x-webhook-secret': webhookSecret },
  })

  const data = await res.json().catch(() => ({}))
  return NextResponse.json({ ok: res.ok, ...data })
}
