import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/getUser'

export default async function ClienteMetricasPage() {
  const { user } = await getAuthUser()
  const supabase = await createClient()

  const { data: client } = await supabase
    .from('clients')
    .select('id, business_name, current_followers')
    .eq('client_user_id', user.id)
    .single()

  interface ReportRow {
    id: string; week_start: string; week_end: string
    posts_published: number; total_reach: number; total_impressions: number
    total_likes: number; total_saves: number; total_comments: number
    net_followers_gained: number; avg_engagement_rate: number | null
    ai_summary: string | null; ai_recommendations: string | null
  }
  interface PostRow {
    id: string; copy: string; platform: string; status: string
    reach: number | null; likes: number | null; saves: number | null
    comments: number | null; engagement_rate: number | null
    published_at: string | null
  }

  let reports: ReportRow[] = []
  let topPosts: PostRow[] = []

  if (client) {
    const [r, p] = await Promise.all([
      supabase
        .from('weekly_reports')
        .select('id, week_start, week_end, posts_published, total_reach, total_impressions, total_likes, total_saves, total_comments, net_followers_gained, avg_engagement_rate, ai_summary, ai_recommendations')
        .eq('client_id', client.id)
        .order('week_start', { ascending: false })
        .limit(8),
      supabase
        .from('posts')
        .select('id, copy, platform, status, reach, likes, saves, comments, engagement_rate, published_at')
        .eq('client_id', client.id)
        .eq('status', 'published')
        .order('reach', { ascending: false })
        .limit(5),
    ])
    reports = (r.data ?? []) as ReportRow[]
    topPosts = (p.data ?? []) as PostRow[]
  }

  const followers = (client?.current_followers as Record<string, number>) ?? {}
  const latestReport = reports[0]

  return (
    <div className="p-4 md:p-8">
      <div>
        <div className="text-xs font-medium uppercase tracking-widest text-brand">Portal</div>
        <h1 className="mt-1 font-serif text-3xl text-ink-900">Métricas</h1>
      </div>

      {!client && (
        <p className="mt-8 text-sm text-ink-400">Tu cuenta aún no está vinculada a ningún cliente.</p>
      )}

      {client && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Object.entries(followers).map(([platform, count]) => (
              <div key={platform} className="rounded-xl border border-ink-200 bg-white p-4">
                <p className="text-[10px] font-medium uppercase tracking-wide text-ink-400 capitalize">{platform}</p>
                <p className="mt-1 font-serif text-2xl text-ink-900">{count?.toLocaleString('es-ES') ?? '—'}</p>
                <p className="text-[10px] text-ink-400">seguidores</p>
              </div>
            ))}
          </div>

          {latestReport && (
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'Alcance', value: latestReport.total_reach.toLocaleString('es-ES') },
                { label: 'Impresiones', value: latestReport.total_impressions.toLocaleString('es-ES') },
                { label: 'Likes', value: latestReport.total_likes.toLocaleString('es-ES') },
                { label: 'Guardados', value: latestReport.total_saves.toLocaleString('es-ES') },
              ].map((m) => (
                <div key={m.label} className="rounded-xl border border-ink-200 bg-white p-4">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-ink-400">{m.label}</p>
                  <p className="mt-1 font-serif text-2xl text-ink-900">{m.value}</p>
                  <p className="text-[10px] text-ink-400">última semana</p>
                </div>
              ))}
            </div>
          )}

          {latestReport?.ai_summary && (
            <div className="mt-6 rounded-xl border border-ink-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand mb-2">Análisis IA — última semana</p>
              <p className="text-sm text-ink-700 leading-relaxed">{latestReport.ai_summary}</p>
              {latestReport.ai_recommendations && (
                <>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-ink-500 mb-2">Recomendaciones</p>
                  <p className="text-sm text-ink-600 leading-relaxed">{latestReport.ai_recommendations}</p>
                </>
              )}
            </div>
          )}

          {topPosts.length > 0 && (
            <div className="mt-6">
              <h2 className="mb-3 text-sm font-semibold text-ink-700">Top 5 publicaciones</h2>
              <div className="overflow-x-auto rounded-xl border border-ink-200 bg-white">
                <table className="min-w-[540px] w-full text-sm">
                  <thead className="border-b border-ink-100 bg-ink-50">
                    <tr>
                      {['Contenido', 'Plataforma', 'Alcance', 'Likes', 'Guardados', 'Engagement'].map((h) => (
                        <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-ink-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-50">
                    {topPosts.map((p) => (
                      <tr key={p.id} className="hover:bg-ink-50">
                        <td className="px-3 py-3 max-w-[200px]">
                          <p className="truncate text-xs text-ink-700">{p.copy}</p>
                          {p.published_at && (
                            <p className="text-[10px] text-ink-400">
                              {new Date(p.published_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-3 text-[10px] text-ink-500">{p.platform}</td>
                        <td className="px-3 py-3 text-xs font-medium">{p.reach?.toLocaleString('es-ES') ?? '—'}</td>
                        <td className="px-3 py-3 text-xs">{p.likes?.toLocaleString('es-ES') ?? '—'}</td>
                        <td className="px-3 py-3 text-xs">{p.saves?.toLocaleString('es-ES') ?? '—'}</td>
                        <td className="px-3 py-3 text-xs">
                          {p.engagement_rate != null ? `${(p.engagement_rate * 100).toFixed(2)}%` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {reports.length > 1 && (
            <div className="mt-6">
              <h2 className="mb-3 text-sm font-semibold text-ink-700">Evolución semanal</h2>
              <div className="overflow-x-auto rounded-xl border border-ink-200 bg-white">
                <table className="min-w-[480px] w-full text-sm">
                  <thead className="border-b border-ink-100 bg-ink-50">
                    <tr>
                      {['Semana', 'Posts', 'Alcance', 'Engagement', 'Nuevos seguidores'].map((h) => (
                        <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-ink-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-50">
                    {reports.map((r) => (
                      <tr key={r.id} className="hover:bg-ink-50">
                        <td className="px-3 py-3 text-xs text-ink-600">
                          {new Date(r.week_start).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                          {' → '}
                          {new Date(r.week_end).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                        </td>
                        <td className="px-3 py-3 text-xs font-medium">{r.posts_published}</td>
                        <td className="px-3 py-3 text-xs">{r.total_reach.toLocaleString('es-ES')}</td>
                        <td className="px-3 py-3 text-xs">
                          {r.avg_engagement_rate != null ? `${(Number(r.avg_engagement_rate) * 100).toFixed(2)}%` : '—'}
                        </td>
                        <td className="px-3 py-3 text-xs">
                          <span className={r.net_followers_gained >= 0 ? 'text-green-600' : 'text-red-500'}>
                            {r.net_followers_gained >= 0 ? '+' : ''}{r.net_followers_gained}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
