import { createClient } from '@/lib/supabase/server'

export default async function AdminReportsPage() {
  const supabase = await createClient()

  const [{ data: reports }, { data: clients }] = await Promise.all([
    supabase
      .from('weekly_reports')
      .select('id, client_id, week_start, week_end, posts_published, total_reach, total_likes, net_followers_gained, avg_engagement_rate, ai_summary, sent_to_client, sent_at, created_at')
      .order('week_start', { ascending: false })
      .limit(60),
    supabase
      .from('clients')
      .select('id, business_name')
      .eq('is_active', true),
  ])

  const clientMap = Object.fromEntries((clients ?? []).map((c) => [c.id, c.business_name]))

  const enriched = (reports ?? []).map((r) => ({
    ...r,
    business_name: clientMap[r.client_id] ?? r.client_id,
  }))

  return (
    <div className="p-4 md:p-8">
      <div>
        <div className="text-xs font-medium uppercase tracking-widest text-brand">Analytics</div>
        <h1 className="mt-1 font-serif text-3xl text-ink-900">Informes semanales</h1>
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-ink-200 bg-white">
        <table className="min-w-[700px] w-full text-sm">
          <thead className="border-b border-ink-200 bg-ink-50">
            <tr>
              {['Cliente', 'Semana', 'Posts', 'Alcance', 'Likes', 'Seguidores +/-', 'Engagement', 'Enviado'].map((h) => (
                <th key={h} className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-400">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {!enriched.length && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-ink-400">
                  Aún no hay informes generados. Se generan automáticamente cada semana.
                </td>
              </tr>
            )}
            {enriched.map((r) => (
              <tr key={r.id} className="hover:bg-ink-50">
                <td className="px-3 py-3 font-medium text-ink-800">{r.business_name}</td>
                <td className="px-3 py-3 text-xs text-ink-500">
                  {r.week_start} → {r.week_end}
                </td>
                <td className="px-3 py-3 text-center font-medium">{r.posts_published}</td>
                <td className="px-3 py-3 text-center">{r.total_reach.toLocaleString('es-ES')}</td>
                <td className="px-3 py-3 text-center">{r.total_likes.toLocaleString('es-ES')}</td>
                <td className="px-3 py-3 text-center">
                  <span className={r.net_followers_gained >= 0 ? 'text-green-600' : 'text-red-500'}>
                    {r.net_followers_gained >= 0 ? '+' : ''}{r.net_followers_gained}
                  </span>
                </td>
                <td className="px-3 py-3 text-center text-xs">
                  {r.avg_engagement_rate ? `${(Number(r.avg_engagement_rate) * 100).toFixed(2)}%` : '—'}
                </td>
                <td className="px-3 py-3">
                  {r.sent_to_client ? (
                    <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700">
                      ✓ Enviado
                    </span>
                  ) : (
                    <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] text-ink-500">
                      Pendiente
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {enriched.some((r) => r.ai_summary) && (
        <div className="mt-6 space-y-4">
          <h2 className="text-sm font-semibold text-ink-700">Últimos resúmenes IA</h2>
          {enriched.filter((r) => r.ai_summary).slice(0, 5).map((r) => (
            <div key={r.id} className="rounded-lg border border-ink-200 bg-white p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-medium text-ink-800">{r.business_name}</span>
                <span className="text-xs text-ink-400">{r.week_start}</span>
              </div>
              <p className="text-sm text-ink-600 leading-relaxed">{r.ai_summary}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
