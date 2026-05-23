import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

// Llama a /api/reviews/harvest cada hora para traer reseñas nuevas de GMB
// y generar borrador IA. El admin las revisa en /admin/reviews.
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

  const res = await fetch(`${baseUrl}/api/reviews/harvest`, {
    method: 'POST',
    headers: { 'x-webhook-secret': webhookSecret },
  })

  const data = await res.json().catch(() => ({}))
  return NextResponse.json({ ok: res.ok, ...data })
}
