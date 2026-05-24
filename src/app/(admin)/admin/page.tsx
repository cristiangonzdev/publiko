import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function AdminDashboardPage() {
  const supabase = await createClient()

  const today = new Date().toISOString().slice(0, 10)
  const thisMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const [
    { data: mrrData },
    { data: clients },
    { data: overdueTasks },
    { data: unassignedTasks },
    { data: todayPosts },
    { data: unansweredReviewsRaw },
    { data: recentActivityRaw },
  ] = await Promise.all([
    supabase.rpc('get_mrr_total'),
    supabase.from('clients').select('id, business_name, status, monthly_fee, contract_end').eq('is_active', true),
    supabase
      .from('content_tasks')
      .select('id, title, client_id, status, deadline')
      .not('status', 'in', '("published","approved")')
      .lt('deadline', today)
      .not('deadline', 'is', null)
      .order('deadline', { ascending: true })
      .limit(5),
    supabase
      .from('content_tasks')
      .select('id, title, client_id, status, content_type')
      .in('status', ['approved_idea', 'brief_sent'])
      .is('grabador_id', null)
      .order('created_at', { ascending: true })
      .limit(5),
    supabase
      .from('content_tasks')
      .select('id, title, client_id, status, publish_at')
      .gte('publish_at', today + 'T00:00:00')
      .lte('publish_at', today + 'T23:59:59')
      .limit(10),
    supabase
      .from('reviews')
      .select('id, client_id, platform, reviewer_name, rating, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('crm_activities')
      .select('id, client_id, activity_type, notes, created_at')
      .order('created_at', { ascending: false })
      .limit(8),
  ])

  interface ReviewRow { id: string; client_id: string; platform: string; reviewer_name: string; rating: number | null; created_at: string }
  const unansweredReviews = (unansweredReviewsRaw ?? []) as unknown as ReviewRow[]
  const recentActivity = (recentActivityRaw ?? []) as unknown as Array<{ id: string; client_id: string; activity_type: string; notes: string | null; created_at: string }>

  const activeClients = (clients ?? []).filter((c) => c.status === 'active')
  const pipelineClients = (clients ?? []).filter((c) => ['lead', 'proposal_sent', 'negotiation'].includes(c.status))
  const riskClients = (clients ?? []).filter((c) => c.status === 'paused')
  const renewingSoon = (clients ?? []).filter((c) => c.contract_end && c.contract_end <= in30Days && c.status === 'active')
  const churnedThisMonth = (clients ?? []).filter((c) => c.status === 'churned')

  const mrr = (mrrData as number) ?? activeClients.reduce((s, c) => s + (c.monthly_fee ?? 0), 0)
  const pipelineMrr = pipelineClients.reduce((s, c) => s + (c.monthly_fee ?? 0), 0)
  const riskMrr = riskClients.reduce((s, c) => s + (c.monthly_fee ?? 0), 0)

  const clientIds = [...new Set([
    ...(overdueTasks ?? []).map((t) => t.client_id),
    ...(unassignedTasks ?? []).map((t) => t.client_id),
    ...(todayPosts ?? []).map((t) => t.client_id),
    ...(unansweredReviews ?? []).map((r) => r.client_id),
    ...(recentActivity ?? []).map((a) => a.client_id),
  ])]
  const { data: clientNames } = await supabase
    .from('clients').select('id, business_name').in('id', clientIds)
  const cMap = Object.fromEntries((clientNames ?? []).map((c) => [c.id, c.business_name]))

  return (
    <div className="p-8">
      <div>
        <div className="text-xs font-medium uppercase tracking-widest text-brand">Admin</div>
        <h1 className="mt-1 font-serif text-3xl text-ink-900">Dashboard</h1>
      </div>

      {/* KPIs */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'MRR', value: `${mrr.toLocaleString('es-ES')} €`, sub: `${activeClients.length} clientes activos` },
          { label: 'Pipeline', value: `${pipelineMrr.toLocaleString('es-ES')} €`, sub: `${pipelineClients.length} en negociación` },
          { label: 'MRR en riesgo', value: `${riskMrr.toLocaleString('es-ES')} €`, sub: `${riskClients.length} pausados`, alert: riskMrr > 0 },
          { label: 'Churn este mes', value: churnedThisMonth.length, sub: 'clientes perdidos', alert: churnedThisMonth.length > 0 },
        ].map((k) => (
          <div key={k.label} className={`rounded-xl border bg-white p-5 ${k.alert ? 'border-red-200' : 'border-ink-200'}`}>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-400">{k.label}</p>
            <p className={`mt-1.5 font-serif text-3xl ${k.alert ? 'text-red-600' : 'text-ink-900'}`}>{k.value}</p>
            <p className="mt-1 text-[11px] text-ink-400">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">

        {/* Tareas vencidas */}
        <section className="rounded-xl border border-ink-200 bg-white">
          <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-ink-800">Tareas vencidas</h2>
            <Link href="/admin/tasks" className="text-xs text-brand hover:underline">Ver todas →</Link>
          </div>
          {!(overdueTasks ?? []).length ? (
            <p className="px-4 py-6 text-sm text-ink-400">Sin tareas vencidas.</p>
          ) : (
            <ul className="divide-y divide-ink-50">
              {(overdueTasks ?? []).map((t) => (
                <li key={t.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-xs font-medium text-brand">{cMap[t.client_id] ?? '—'}</p>
                    <p className="text-sm text-ink-800">{t.title}</p>
                  </div>
                  <span className="text-[10px] text-red-500">
                    {t.deadline ? new Date(t.deadline).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Sin asignar */}
        <section className="rounded-xl border border-ink-200 bg-white">
          <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-ink-800">Tareas sin grabador</h2>
            <Link href="/admin/tasks" className="text-xs text-brand hover:underline">Asignar →</Link>
          </div>
          {!(unassignedTasks ?? []).length ? (
            <p className="px-4 py-6 text-sm text-ink-400">Todo asignado.</p>
          ) : (
            <ul className="divide-y divide-ink-50">
              {(unassignedTasks ?? []).map((t) => (
                <li key={t.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-xs font-medium text-brand">{cMap[t.client_id] ?? '—'}</p>
                    <p className="text-sm text-ink-800">{t.title}</p>
                  </div>
                  <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[10px] text-ink-500">{t.content_type}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Posts de hoy */}
        <section className="rounded-xl border border-ink-200 bg-white">
          <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-ink-800">Publicaciones hoy</h2>
            <Link href="/admin/calendar" className="text-xs text-brand hover:underline">Calendario →</Link>
          </div>
          {!(todayPosts ?? []).length ? (
            <p className="px-4 py-6 text-sm text-ink-400">Sin publicaciones programadas hoy.</p>
          ) : (
            <ul className="divide-y divide-ink-50">
              {(todayPosts ?? []).map((t) => (
                <li key={t.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-xs font-medium text-brand">{cMap[t.client_id] ?? '—'}</p>
                    <p className="text-sm text-ink-800">{t.title}</p>
                  </div>
                  <span className="text-[10px] text-ink-400">
                    {t.publish_at ? new Date(t.publish_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Reseñas sin responder */}
        <section className="rounded-xl border border-ink-200 bg-white">
          <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-ink-800">Reseñas sin responder</h2>
            <Link href="/admin/reviews" className="text-xs text-brand hover:underline">Ver todas →</Link>
          </div>
          {!(unansweredReviews ?? []).length ? (
            <p className="px-4 py-6 text-sm text-ink-400">Sin reseñas pendientes.</p>
          ) : (
            <ul className="divide-y divide-ink-50">
              {(unansweredReviews ?? []).map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="text-base leading-none">
                    {'⭐'.repeat(Math.min(r.rating ?? 5, 5))}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-brand">{cMap[r.client_id] ?? '—'} · {r.platform}</p>
                    <p className="truncate text-sm text-ink-700">{r.reviewer_name}</p>
                  </div>
                  <span className="text-[10px] text-ink-400">
                    {new Date(r.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Renovaciones próximas */}
      {renewingSoon.length > 0 && (
        <section className="mt-5 rounded-xl border border-yellow-200 bg-yellow-50 p-4">
          <p className="text-xs font-semibold text-yellow-700 mb-2">Contratos que renuevan en 30 días</p>
          <div className="flex flex-wrap gap-2">
            {renewingSoon.map((c) => (
              <Link key={c.id} href={`/admin/clients/${c.id}`}
                className="rounded-md border border-yellow-300 bg-white px-3 py-1.5 text-xs text-ink-700 hover:bg-yellow-50">
                {c.business_name} — {new Date(c.contract_end!).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Accesos rápidos */}
      <div className="mt-6 flex flex-wrap gap-2">
        {[
          { href: '/admin/atascado', label: '🚨 Qué está atascado' },
          { href: '/admin/clients/new', label: '+ Nuevo cliente' },
          { href: '/admin/ideas', label: 'Ideas pendientes' },
          { href: '/admin/review', label: 'Revisión entregables' },
          { href: '/admin/ideas/human-input', label: 'Añadir idea' },
        ].map((link) => (
          <Link key={link.href} href={link.href}
            className="rounded-md border border-ink-200 bg-white px-4 py-2 text-sm text-ink-700 hover:bg-ink-50">
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
