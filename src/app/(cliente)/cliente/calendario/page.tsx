import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/getUser'

export default async function ClienteCalendarioPage() {
  const { user } = await getAuthUser()
  const supabase = await createClient()

  const { data: client } = await supabase
    .from('clients')
    .select('id, business_name')
    .eq('client_user_id', user.id)
    .single()

  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const end = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString()

  interface PostItem {
    id: string; copy: string; platform: string; status: string
    scheduled_at: string | null; published_at: string | null
  }
  interface TaskItem {
    id: string; title: string; status: string; content_type: string
    publish_at: string | null; target_platforms: string[]
  }

  let posts: PostItem[] = []
  let tasks: TaskItem[] = []

  if (client) {
    const [p, t] = await Promise.all([
      supabase
        .from('posts')
        .select('id, copy, platform, status, scheduled_at, published_at')
        .eq('client_id', client.id)
        .gte('scheduled_at', start)
        .lte('scheduled_at', end)
        .order('scheduled_at', { ascending: true }),
      supabase
        .from('content_tasks')
        .select('id, title, status, content_type, publish_at, target_platforms')
        .eq('client_id', client.id)
        .not('publish_at', 'is', null)
        .gte('publish_at', start)
        .lte('publish_at', end)
        .order('publish_at', { ascending: true }),
    ])
    posts = (p.data ?? []) as PostItem[]
    tasks = (t.data ?? []) as TaskItem[]
  }

  // Merge posts + tasks por día
  interface DayItem {
    id: string
    type: 'post' | 'task'
    label: string
    platform?: string
    platforms?: string[]
    status: string
    time: string
  }
  const byDay: Record<string, DayItem[]> = {}

  const addToDay = (day: string, item: DayItem) => {
    if (!byDay[day]) byDay[day] = []
    byDay[day].push(item)
  }

  for (const p of posts) {
    const date = p.scheduled_at ?? p.published_at
    if (!date) continue
    addToDay(date.slice(0, 10), {
      id: p.id, type: 'post',
      label: p.copy?.slice(0, 80) ?? '',
      platform: p.platform, status: p.status,
      time: date,
    })
  }
  for (const t of tasks) {
    if (!t.publish_at) continue
    addToDay(t.publish_at.slice(0, 10), {
      id: t.id, type: 'task',
      label: t.title,
      platforms: t.target_platforms as string[],
      status: t.status,
      time: t.publish_at,
    })
  }

  const STATUS_PILL: Record<string, string> = {
    scheduled: 'bg-teal-50 text-teal-700',
    published: 'bg-blue-50 text-blue-700',
    approved: 'bg-green-50 text-green-700',
    editing: 'bg-yellow-50 text-yellow-700',
  }

  return (
    <div className="p-4 md:p-8">
      <div>
        <div className="text-xs font-medium uppercase tracking-widest text-brand">Portal</div>
        <h1 className="mt-1 font-serif text-3xl text-ink-900">Calendario de contenido</h1>
      </div>

      {!client && (
        <p className="mt-8 text-sm text-ink-400">Tu cuenta aún no está vinculada a ningún cliente.</p>
      )}

      <div className="mt-6 space-y-3">
        {client && Object.keys(byDay).length === 0 && (
          <p className="text-sm text-ink-400 mt-4">Sin contenido programado en los próximos 2 meses.</p>
        )}
        {Object.entries(byDay).map(([day, items]) => {
          const date = new Date(day + 'T12:00:00')
          const label = date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
          return (
            <div key={day} className="rounded-xl border border-ink-200 bg-white overflow-hidden">
              <div className="border-b border-ink-100 bg-ink-50 px-4 py-2">
                <span className="text-xs font-semibold capitalize text-ink-600">{label}</span>
              </div>
              <div className="divide-y divide-ink-50">
                {items.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 px-4 py-3">
                    <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-xs">
                      {item.type === 'post' ? '📣' : '🎬'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-ink-800">{item.label}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {item.platform && (
                          <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[10px] text-ink-500">{item.platform}</span>
                        )}
                        {(item.platforms ?? []).map((p) => (
                          <span key={p} className="rounded bg-ink-100 px-1.5 py-0.5 text-[10px] text-ink-500">{p}</span>
                        ))}
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_PILL[item.status] ?? 'bg-ink-100 text-ink-500'}`}>
                          {item.status}
                        </span>
                        <span className="text-[10px] text-ink-400">
                          {new Date(item.time).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
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
