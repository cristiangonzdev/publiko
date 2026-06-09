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

      if (reviews.length === 0) continue

      const externalIds = reviews.map((r) => r.reviewId)

      // Índice de control: UNA query por cliente en lugar de una por reseña (evita N+1).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existingRows, error: existingErr } = await (supabase.from('reviews') as any)
        .select('id, external_review_id, status')
        .eq('client_id', client.id)
        .in('external_review_id', externalIds) as {
          data: { id: string; external_review_id: string; status: string }[] | null
          error: { message: string } | null
        }

      if (existingErr) {
        errors.push(`${client.business_name}: load existing reviews: ${existingErr.message}`)
        continue
      }

      const existingById = new Map(
        (existingRows ?? []).map((r) => [r.external_review_id, r]),
      )

      // Reseñas que ya tenían fila pero ahora aparecen respondidas externamente.
      const toMarkResponded = reviews.filter((review) => {
        const existing = existingById.get(review.reviewId)
        return existing && review.reviewReply && existing.status !== 'responded'
      })

      for (const review of toMarkResponded) {
        const existing = existingById.get(review.reviewId)!
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updErr } = await (supabase.from('reviews') as any)
          .update({
            status: 'responded',
            response_selected: review.reviewReply!.comment,
            response_published_at: review.reviewReply!.updateTime,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
        if (updErr) errors.push(`${client.business_name}: mark responded ${review.reviewId}: ${updErr.message}`)
      }

      // Reseñas realmente nuevas: insertarlas en bloque con upsert idempotente.
      const newReviews = reviews.filter((review) => !existingById.has(review.reviewId))
      if (newReviews.length === 0) continue

      const rowsToInsert = newReviews.map((review) => {
        const externalId = review.reviewId
        return {
          client_id: client.id,
          source: 'gmb',
          external_id: externalId,
          external_review_id: externalId,
          author_name: review.reviewer?.displayName ?? 'Anónimo',
          rating: reviewStarsToNumber(review.starRating),
          text: review.comment ?? '',
          review_date: review.createTime,
          status: review.reviewReply ? 'responded' : 'pending',
          response_selected: review.reviewReply?.comment ?? null,
          response_published_at: review.reviewReply?.updateTime ?? null,
        }
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: insertedRows, error: insertErr } = await (supabase.from('reviews') as any)
        .upsert(rowsToInsert, { onConflict: 'client_id,external_review_id' })
        .select('id, external_review_id') as {
          data: { id: string; external_review_id: string }[] | null
          error: { message: string } | null
        }

      if (insertErr) {
        errors.push(`${client.business_name}: insert reviews: ${insertErr.message}`)
        continue
      }

      const insertedById = new Map(
        (insertedRows ?? []).map((r) => [r.external_review_id, r.id]),
      )
      totalNew += insertedRows?.length ?? 0

      // Generar borrador IA SOLO para reseñas realmente nuevas y pendientes.
      const pendingForDraft = newReviews.filter(
        (review) => !review.reviewReply && (review.comment ?? '').trim(),
      )
      if (pendingForDraft.length === 0) continue

      // El Brand Brain se carga una sola vez por cliente.
      const { data: brain, error: brainErr } = await supabase
        .from('brand_brains')
        .select('*')
        .eq('client_id', client.id)
        .single()

      if (brainErr || !brain) {
        if (brainErr) errors.push(`${client.business_name}: load brain: ${brainErr.message}`)
        continue
      }

      for (const review of pendingForDraft) {
        const reviewId = insertedById.get(review.reviewId)
        if (!reviewId) continue
        try {
          const options = await generateReviewResponse(
            brain as unknown as Record<string, unknown>,
            {
              author_name: review.reviewer?.displayName ?? 'Anónimo',
              rating: reviewStarsToNumber(review.starRating),
              text: review.comment ?? '',
            },
          )
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: draftErr } = await (supabase.from('reviews') as any)
            .update({
              response_options: options,
              ai_draft: options[0] ?? null,
              ai_draft_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', reviewId)
          if (draftErr) {
            errors.push(`${client.business_name}: save draft ${review.reviewId}: ${draftErr.message}`)
          } else {
            totalDrafts++
          }
        } catch (err) {
          console.error('AI draft failed for review', review.reviewId, err)
        }
      }
    } catch (err) {
      errors.push(`${client.business_name}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return NextResponse.json({ harvested: totalNew, drafts: totalDrafts, errors })
}
