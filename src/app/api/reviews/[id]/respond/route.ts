import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { replyReview } from '@/lib/gmb'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { response } = (await request.json()) as { response: string }
  if (!response?.trim()) return NextResponse.json({ error: 'response required' }, { status: 400 })

  const service = await createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: review } = await (service.from('reviews') as any)
    .select('id, client_id, source, external_review_id, clients!inner(gmb_account_id, gmb_location_id)')
    .eq('id', id)
    .single() as { data: {
      id: string
      client_id: string
      source: string | null
      external_review_id: string | null
      clients: { gmb_account_id: string | null; gmb_location_id: string | null }
    } | null }

  if (!review) return NextResponse.json({ error: 'Reseña no encontrada' }, { status: 404 })

  // Si es GMB y tenemos credentials, publicar de verdad
  const gmb = review.clients
  if (review.source === 'gmb' && review.external_review_id && gmb.gmb_account_id && gmb.gmb_location_id) {
    try {
      await replyReview({
        accountId: gmb.gmb_account_id,
        locationId: gmb.gmb_location_id,
        reviewId: review.external_review_id,
        comment: response.trim(),
      })
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : String(err) },
        { status: 500 },
      )
    }
  }

  const { error } = await supabase
    .from('reviews')
    .update({
      response_selected: response,
      response_published_at: new Date().toISOString(),
      responded_by: user.id,
      status: 'responded',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
