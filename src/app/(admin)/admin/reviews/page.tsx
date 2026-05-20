import { createClient } from '@/lib/supabase/server'
import { ReviewsManager } from '@/components/content/ReviewsManager'

export default async function ReviewsPage() {
  const supabase = await createClient()

  const { data: reviews } = await supabase
    .from('reviews')
    .select('id, client_id, source, author_name, rating, text, review_date, response_options, response_selected, status, sentiment')
    .in('status', ['pending', 'needs_response'])
    .order('review_date', { ascending: false })
    .limit(50)

  const clientIds = [...new Set((reviews ?? []).map((r) => r.client_id))]
  const { data: clients } = await supabase
    .from('clients')
    .select('id, business_name')
    .in('id', clientIds.length > 0 ? clientIds : ['none'])

  const clientMap = Object.fromEntries((clients ?? []).map((c) => [c.id, c.business_name]))

  const items = (reviews ?? []).map((r) => ({
    ...r,
    business_name: clientMap[r.client_id] ?? r.client_id,
    response_options: (r.response_options as string[]) ?? [],
  }))

  return (
    <div className="p-8">
      <div>
        <div className="text-xs font-medium uppercase tracking-widest text-brand">Reseñas</div>
        <h1 className="mt-1 font-serif text-3xl text-ink-900">Gestión de reseñas</h1>
        <p className="mt-1 text-sm text-ink-500">{items.length} pendientes de respuesta</p>
      </div>

      <ReviewsManager initialReviews={items} />
    </div>
  )
}
