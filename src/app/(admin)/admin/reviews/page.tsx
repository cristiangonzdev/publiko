import { createClient } from '@/lib/supabase/server'
import { ReviewsManager } from '@/components/content/ReviewsManager'

export default async function ReviewsPage() {
  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: reviews } = await (supabase.from('reviews') as any)
    .select('id, client_id, source, author_name, rating, text, review_date, response_options, response_selected, status, sentiment, ai_draft, ai_draft_at')
    .in('status', ['pending', 'needs_response'])
    .order('review_date', { ascending: false })
    .limit(50)

  interface ReviewRow {
    id: string
    client_id: string
    source: string
    author_name: string | null
    rating: number | null
    text: string | null
    review_date: string | null
    response_options: string[] | null
    response_selected: string | null
    status: string
    sentiment: string | null
    ai_draft: string | null
    ai_draft_at: string | null
  }
  const rows: ReviewRow[] = (reviews ?? []) as ReviewRow[]

  const clientIds = [...new Set(rows.map((r) => r.client_id))]
  const { data: clients } = await supabase
    .from('clients')
    .select('id, business_name')
    .in('id', clientIds.length > 0 ? clientIds : ['none'])

  const clientMap = Object.fromEntries((clients ?? []).map((c) => [c.id, c.business_name]))

  const items = rows.map((r) => ({
    ...r,
    business_name: clientMap[r.client_id] ?? r.client_id,
    response_options: r.response_options ?? [],
  }))

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div>
        <div className="text-xs font-medium uppercase tracking-widest text-brand">Reseñas</div>
        <h1 className="mt-1 font-serif text-2xl sm:text-3xl text-ink-900">Gestión de reseñas</h1>
        <p className="mt-1 text-sm text-ink-500">{items.length} pendientes de respuesta</p>
      </div>

      <ReviewsManager initialReviews={items} />
    </div>
  )
}
