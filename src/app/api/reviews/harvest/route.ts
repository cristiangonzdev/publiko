import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchReviews, reviewStarsToNumber } from '@/lib/gmb'
import { generateReviewResponse } from '@/lib/claude'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-webhook-secret')
  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createServiceClient()

  interface GmbClient {
    id: string
    business_name: string
    gmb_account_id: string | null
    gmb_location_id: string | null
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: clientsRaw } = await (supabase.from('clients') as any)
    .select('id, business_name, gmb_account_id, gmb_location_id')
    .eq('is_active', true)
    .not('gmb_location_id', 'is', null) as { data: GmbClient[] | null }

  const clients = clientsRaw ?? []
  if (clients.length === 0) return NextResponse.json({ harvested: 0 })

  let totalNew = 0
  let totalDrafts = 0
  const errors: string[] = []

  for (const client of clients) {
    if (!client.gmb_account_id || !client.gmb_location_id) continue

    try {
      const reviews = await fetchReviews({
        accountId: client.gmb_account_id,
        locationId: client.gmb_location_id,
        pageSize: 50,
      })

      for (const review of reviews) {
        const externalId = review.reviewId
        const rating = reviewStarsToNumber(review.starRating)
        const text = review.comment ?? ''
        const authorName = review.reviewer?.displayName ?? 'Anónimo'
        const reviewDate = review.createTime

        // Si ya existe, actualizar respuesta publicada en caso de cambios externos
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: existing } = await (supabase.from('reviews') as any)
          .select('id, status, ai_draft')
          .eq('client_id', client.id)
          .eq('external_review_id', externalId)
          .maybeSingle() as { data: { id: string; status: string; ai_draft: string | null } | null }

        if (existing) {
          // si ya tenía respuesta externa y ahora aparece reviewReply, marcar como respondida
          if (review.reviewReply && existing.status !== 'responded') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase.from('reviews') as any)
              .update({
                status: 'responded',
                response_selected: review.reviewReply.comment,
                response_published_at: review.reviewReply.updateTime,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existing.id)
          }
          continue
        }

        // Insert nueva reseña
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: inserted } = await (supabase.from('reviews') as any)
          .insert({
            client_id: client.id,
            source: 'gmb',
            external_id: externalId,
            external_review_id: externalId,
            author_name: authorName,
            rating,
            text,
            review_date: reviewDate,
            status: review.reviewReply ? 'responded' : 'pending',
            response_selected: review.reviewReply?.comment ?? null,
            response_published_at: review.reviewReply?.updateTime ?? null,
          })
          .select('id')
          .single() as { data: { id: string } | null }

        if (!inserted) continue
        totalNew++

        // Generar borrador con Claude solo si está pendiente
        if (!review.reviewReply && text.trim()) {
          try {
            const { data: brain } = await supabase
              .from('brand_brains')
              .select('*')
              .eq('client_id', client.id)
              .single()

            if (brain) {
              const options = await generateReviewResponse(
                brain as unknown as Record<string, unknown>,
                { author_name: authorName, rating, text },
              )
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await (supabase.from('reviews') as any)
                .update({
                  response_options: options,
                  ai_draft: options[0] ?? null,
                  ai_draft_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .eq('id', inserted.id)
              totalDrafts++
            }
          } catch (err) {
            console.error('AI draft failed for review', externalId, err)
          }
        }
      }
    } catch (err) {
      errors.push(`${client.business_name}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return NextResponse.json({ harvested: totalNew, drafts: totalDrafts, errors })
}
