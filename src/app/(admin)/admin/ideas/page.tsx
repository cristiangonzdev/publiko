import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

const STATUS_COLOR: Record<string, string> = {
  suggested: 'bg-ink-100 text-ink-600',
  approved: 'bg-blue-50 text-blue-700',
  in_production: 'bg-yellow-50 text-yellow-700',
  published: 'bg-green-50 text-green-700',
  discarded: 'bg-ink-50 text-ink-400',
}

export default async function GlobalIdeasPage() {
  const supabase = await createClient()

  const { data: ideas } = await supabase
    .from('content_ideas')
    .select('id, client_id, concept, content_type, angle, content_origin, status, created_at')
    .in('status', ['suggested', 'approved'])
    .order('created_at', { ascending: false })
    .limit(50)

  const clientIds = [...new Set((ideas ?? []).map((i) => i.client_id))]
  const { data: clients } = await supabase
    .from('clients')
    .select('id, business_name')
    .in('id', clientIds.length > 0 ? clientIds : ['none'])

  const clientMap = Object.fromEntries((clients ?? []).map((c) => [c.id, c.business_name]))

  const suggested = ideas?.filter((i) => i.status === 'suggested') ?? []
  const approved = ideas?.filter((i) => i.status === 'approved') ?? []

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-widest text-brand">Ideas</div>
          <h1 className="mt-1 font-serif text-3xl text-ink-900">Banco de ideas</h1>
          <p className="mt-1 text-sm text-ink-500">{suggested.length} sugeridas · {approved.length} aprobadas</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-sm font-semibold text-ink-700">Sugeridas ({suggested.length})</h2>
          <div className="space-y-3">
            {suggested.length === 0 && (
              <p className="text-sm text-ink-400">Sin ideas sugeridas.</p>
            )}
            {suggested.map((idea) => (
              <div key={idea.id} className="rounded-lg border border-ink-200 bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/admin/clients/${idea.client_id}/ideas`}
                      className="text-[10px] font-medium text-brand hover:underline"
                    >
                      {clientMap[idea.client_id] ?? idea.client_id}
                    </Link>
                    <p className="mt-0.5 text-sm font-medium text-ink-900">{idea.concept}</p>
                    <div className="mt-1 flex gap-2 text-[10px] text-ink-400">
                      <span>{idea.content_type}</span>
                      {idea.angle && <span>· {idea.angle}</span>}
                      <span className={`rounded px-1.5 py-0.5 ${idea.content_origin === 'system' ? 'bg-ink-100' : 'bg-purple-50 text-purple-600'}`}>
                        {idea.content_origin === 'system' ? 'IA' : 'Humano'}
                      </span>
                    </div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium flex-shrink-0 ${STATUS_COLOR[idea.status]}`}>
                    {idea.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-ink-700">Aprobadas ({approved.length})</h2>
          <div className="space-y-3">
            {approved.length === 0 && (
              <p className="text-sm text-ink-400">Sin ideas aprobadas pendientes de producción.</p>
            )}
            {approved.map((idea) => (
              <div key={idea.id} className="rounded-lg border border-blue-100 bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/admin/clients/${idea.client_id}/ideas`}
                      className="text-[10px] font-medium text-brand hover:underline"
                    >
                      {clientMap[idea.client_id] ?? idea.client_id}
                    </Link>
                    <p className="mt-0.5 text-sm font-medium text-ink-900">{idea.concept}</p>
                    <div className="mt-1 flex gap-2 text-[10px] text-ink-400">
                      <span>{idea.content_type}</span>
                      {idea.angle && <span>· {idea.angle}</span>}
                    </div>
                  </div>
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 flex-shrink-0">
                    Aprobada
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
