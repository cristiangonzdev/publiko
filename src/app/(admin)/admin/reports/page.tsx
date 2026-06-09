import { createClient } from '@/lib/supabase/server'

type ChurnLevel = 'low' | 'medium' | 'high'

function ChurnBadge({ level, factors }: { level: ChurnLevel | null; factors: string[] | null }) {
  if (!level) return null

  const styles: Record<ChurnLevel, string> = {
    low: 'bg-green-50 text-green-700 border border-green-200',
    medium: 'bg-orange-50 text-orange-700 border border-orange-200',
    high: 'bg-red-50 text-red-700 border border-red-200',
  }
  const labels: Record<ChurnLevel, string> = {
    low: '● Riesgo bajo',
    medium: '● Riesgo medio',
    high: '● Riesgo alto',
  }

  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${styles[level]}`}
      title={factors?.join('\n') ?? ''}
    >
      {labels[level]}
    </span>
  )
}

function EngagementChange({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="text-ink-400">—</span>
  const sign = pct >= 0 ? '+' : ''
  const color = pct >= 0 ? 'text-green-600' : 'text-red-500'
  return <span className={`text-xs font-medium ${color}`}>{sign}{pct.toFixed(1)}%</span>
}

interface ReportRow {
  id: string
  client_id: string
  week_start: string
  week_end: string
  posts_published: number
  total_reach: number
  total_likes: number
  net_followers_gained: number
  avg_engagement_rate: number | null
  engagement_change_pct: number | null
  churn_risk_level: string | null
  churn_risk_factors: string[] | null
  ai_summary: string | null
  executive_narrative: string | null
  sent_to_client: boolean
  sent_at: string | null
}

export default async function AdminReportsPage() {
  const supabase = await createClient()

  const [{ data: rawReports }, { data: clients }] = await Promise.all([
    // engagement_change_pct, churn_risk_level, churn_risk_factors, executive_narrative added in migration 0013
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('weekly_reports')
      .select('id, client_id, week_start, week_end, posts_published, total_reach, total_likes, net_followers_gained, avg_engagement_rate, engagement_change_pct, churn_risk_level, churn_risk_factors, ai_summary, executive_narrative, sent_to_client, sent_at')
      .order('week_start', { ascending: false })
      .limit(60),
    supabase
      .from('clients')
      .select('id, business_name')
      .eq('is_active', true),
  ])

  const reports = (rawReports ?? []) as ReportRow[]
  const clientMap = Object.fromEntries((clients ?? []).map((c) => [c.id, c.business_name]))

  const enriched = reports.map((r) => ({
    ...r,
    business_name: clientMap[r.client_id] ?? r.client_id,
  }))

  const highRisk = enriched.filter((r) => r.churn_risk_level === 'high')

  return (
    <div className="p-4 md:p-8">
      <div>
        <div className="text-xs font-medium uppercase tracking-widest text-brand">Analytics</div>
        <h1 className="mt-1 font-serif text-3xl text-ink-900">Informes semanales</h1>
      </div>

      {highRisk.length > 0 && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-medium text-red-800">
            ⚠️ {highRisk.length} cliente{highRisk.length > 1 ? 's' : ''} con riesgo de churn alto esta semana:{' '}
            {highRisk.map((r) => r.business_name).join(', ')}
          </p>
        </div>
      )}

      <div className="mt-6 overflow-x-auto rounded-lg border border-ink-200 bg-white">
        <table className="min-w-[800px] w-full text-sm">
          <thead className="border-b border-ink-200 bg-ink-50">
            <tr>
              {['Cliente', 'Semana', 'Posts', 'Alcance', 'Likes', 'Engagement', 'Vs semana ant.', 'Riesgo churn', 'Enviado'].map((h) => (
                <th key={h} className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-400">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {!enriched.length && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-sm text-ink-400">
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
                <td className="px-3 py-3 text-center text-xs">
                  {r.avg_engagement_rate ? `${(Number(r.avg_engagement_rate) * 100).toFixed(2)}%` : '—'}
                </td>
                <td className="px-3 py-3 text-center">
                  <EngagementChange pct={r.engagement_change_pct != null ? Number(r.engagement_change_pct) : null} />
                </td>
                <td className="px-3 py-3">
                  <ChurnBadge
                    level={(r.churn_risk_level as ChurnLevel | null)}
                    factors={r.churn_risk_factors}
                  />
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

      {enriched.some((r) => r.executive_narrative || r.ai_summary) && (
        <div className="mt-6 space-y-4">
          <h2 className="text-sm font-semibold text-ink-700">Narrativa ejecutiva</h2>
          {enriched
            .filter((r) => r.executive_narrative || r.ai_summary)
            .slice(0, 5)
            .map((r) => (
              <div key={r.id} className="rounded-lg border border-ink-200 bg-white p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-ink-800">{r.business_name}</span>
                    <ChurnBadge
                      level={(r.churn_risk_level as ChurnLevel | null)}
                      factors={r.churn_risk_factors}
                    />
                  </div>
                  <span className="text-xs text-ink-400">{r.week_start}</span>
                </div>
                {r.executive_narrative ? (
                  <p className="text-sm text-ink-700 leading-relaxed">{r.executive_narrative}</p>
                ) : (
                  <p className="text-sm text-ink-600 leading-relaxed">{r.ai_summary}</p>
                )}
                {r.churn_risk_factors && r.churn_risk_factors.length > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {r.churn_risk_factors.map((f) => (
                      <li key={f} className="text-xs text-red-600 flex gap-1">
                        <span>·</span><span>{f}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  )
}
