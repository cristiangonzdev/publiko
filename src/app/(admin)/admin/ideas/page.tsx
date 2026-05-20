import { createClient } from '@/lib/supabase/server'
import { GlobalIdeasBoard } from '@/components/content/GlobalIdeasBoard'

export default async function GlobalIdeasPage() {
  const supabase = await createClient()

  const [{ data: ideas }, { data: clients }] = await Promise.all([
    supabase
      .from('content_ideas')
      .select('id, client_id, concept, full_description, content_type, angle, content_origin, status, human_input, content_task_id, created_at')
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('clients')
      .select('id, business_name')
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('business_name'),
  ])

  const clientMap = Object.fromEntries((clients ?? []).map((c) => [c.id, c.business_name]))

  const enrichedIdeas = (ideas ?? []).map((idea) => ({
    ...idea,
    client_name: clientMap[idea.client_id] ?? idea.client_id,
  }))

  const suggested = enrichedIdeas.filter((i) => i.status === 'suggested').length
  const approved = enrichedIdeas.filter((i) => i.status === 'approved').length
  const inProduction = enrichedIdeas.filter((i) => i.status === 'in_production').length

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-widest text-brand">Ideas</div>
          <h1 className="mt-1 font-serif text-3xl text-ink-900">Banco de ideas</h1>
          <p className="mt-1 text-sm text-ink-500">
            {suggested} sugeridas · {approved} aprobadas · {inProduction} en producción
          </p>
        </div>
      </div>

      <GlobalIdeasBoard
        initialIdeas={enrichedIdeas as Parameters<typeof GlobalIdeasBoard>[0]['initialIdeas']}
        clients={clients ?? []}
      />
    </div>
  )
}
