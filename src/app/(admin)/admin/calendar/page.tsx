import { createClient } from '@/lib/supabase/server'

export default async function AdminCalendarPage() {
  const supabase = await createClient()

  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const end = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString()

  const [{ data: tasks }, { data: clients }] = await Promise.all([
    supabase
      .from('content_tasks')
      .select('id, client_id, title, status, content_type, publish_at, target_platforms')
      .not('status', 'in', '("failed")')
      .gte('publish_at', start)
      .lte('publish_at', end)
      .order('publish_at', { ascending: true }),
    supabase
      .from('clients')
      .select('id, business_name')
      .eq('is_active', true),
  ])

  const clientMap = Object.fromEntries((clients ?? []).map((c) => [c.id, c.business_name]))

  const enriched = (tasks ?? []).map((t) => ({
    ...t,
    business_name: clientMap[t.client_id] ?? t.client_id,
  }))

  // Agrupar por día
  const byDay: Record<string, typeof enriched> = {}
  for (const t of enriched) {
    if (!t.publish_at) continue
    const day = t.publish_at.slice(0, 10)
    if (!byDay[day]) byDay[day] = []
    byDay[day].push(t)
  }

  const STATUS_DOT: Record<string, string> = {
    scheduled: 'bg-teal-400',
    approved: 'bg-green-400',
    published: 'bg-blue-400',
    editing: 'bg-orange-400',
    delivered: 'bg-pink-400',
  }

  return (
    <div className="p-4 md:p-8">
      <div>
        <div className="text-xs font-medium uppercase tracking-widest text-brand">Producción</div>
        <h1 className="mt-1 font-serif text-3xl text-ink-900">Calendario de publicación</h1>
      </div>

      <div className="mt-6 space-y-3">
        {Object.keys(byDay).length === 0 && (
          <p className="text-sm text-ink-400 mt-8">No hay publicaciones programadas en los próximos 2 meses.</p>
        )}
        {Object.entries(byDay).map(([day, items]) => {
          const date = new Date(day + 'T12:00:00')
          const label = date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
          return (
            <div key={day} className="rounded-lg border border-ink-200 bg-white overflow-hidden">
              <div className="border-b border-ink-100 bg-ink-50 px-4 py-2">
                <span className="text-xs font-semibold capitalize text-ink-600">{label}</span>
              </div>
              <div className="divide-y divide-ink-50">
                {items.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[t.status] ?? 'bg-ink-300'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-medium text-brand">{t.business_name}</p>
                      <p className="truncate text-sm font-medium text-ink-800">{t.title}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[10px] text-ink-500">
                        {t.content_type}
                      </span>
                      {(t.target_platforms as string[] ?? []).map((p) => (
                        <span key={p} className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-600">{p}</span>
                      ))}
                      <span className="text-[10px] text-ink-400">
                        {t.publish_at ? new Date(t.publish_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
