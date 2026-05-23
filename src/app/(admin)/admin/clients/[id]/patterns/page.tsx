import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { MarkWinnerButton, ArchivePatternButton } from '@/components/admin/WinnerActions'

interface Props {
  params: Promise<{ id: string }>
}

interface PatternFeatures {
  content_type?: string | null
  angle?: string | null
  platform?: string | null
  hook?: string | null
  concept_summary?: string | null
  publish_hour?: string | null
  weekday?: string | null
  has_cta?: boolean | null
  copy_excerpt?: string | null
}

interface PatternRow {
  id: string
  source: string
  features: PatternFeatures
  manual_reason: string | null
  impact_multiplier: number | null
  metrics_snapshot: Record<string, number | null>
  created_at: string
  post_id: string | null
}

interface PostRow {
  id: string
  platform: string
  copy: string
  published_at: string | null
  reach: number | null
  engagement_rate: number | null
  is_winner: boolean
  winner_source: string | null
  external_url: string | null
}

const weekdayLabel: Record<string, string> = {
  monday: 'Lunes', tuesday: 'Martes', wednesday: 'Miércoles', thursday: 'Jueves',
  friday: 'Viernes', saturday: 'Sábado', sunday: 'Domingo',
}

const sourceBadge: Record<string, { label: string; cls: string }> = {
  auto: { label: 'Auto (métricas)', cls: 'bg-blue-50 text-blue-700' },
  manual: { label: 'Manual (tú)', cls: 'bg-yellow-50 text-yellow-700' },
  hybrid: { label: 'Auto + Manual', cls: 'bg-purple-50 text-purple-700' },
}

export default async function PatternsPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  interface BaselineRow {
    platform: string
    content_type: string
    median_engagement_rate: number | null
    sample_size: number
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const [{ data: client }, { data: patterns }, { data: recentPosts }, { data: baselines }] = await Promise.all([
    supabase.from('clients').select('id, business_name').eq('id', id).single(),
    (supabase.from('winning_patterns') as any)
      .select('id, source, features, manual_reason, impact_multiplier, metrics_snapshot, created_at, post_id')
      .eq('client_id', id)
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(50) as Promise<{ data: PatternRow[] | null }>,
    (supabase.from('posts') as any)
      .select('id, platform, copy, published_at, reach, engagement_rate, is_winner, winner_source, external_url')
      .eq('client_id', id)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(20) as Promise<{ data: PostRow[] | null }>,
    (supabase.from('client_performance_baselines') as any)
      .select('platform, content_type, median_engagement_rate, sample_size')
      .eq('client_id', id) as Promise<{ data: BaselineRow[] | null }>,
  ])
  /* eslint-enable @typescript-eslint/no-explicit-any */

  if (!client) notFound()

  const typedPatterns = patterns ?? []
  const typedPosts = recentPosts ?? []

  return (
    <div className="p-8 max-w-5xl">
      <div>
        <Link href={`/admin/clients/${id}`} className="text-xs text-ink-400 hover:text-ink-700">
          ← {client.business_name}
        </Link>
        <h1 className="mt-2 font-serif text-3xl text-ink-900">Patrones aprendidos</h1>
        <p className="mt-1 text-sm text-ink-500">
          Lo que ha funcionado para este cliente. Se inyecta automáticamente al generar ideas y copy.
        </p>
      </div>

      {baselines && baselines.length > 0 && (
        <section className="mt-6 rounded-lg border border-ink-200 bg-white p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-400">
            Baseline de engagement (últimos 60 días)
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {baselines.map((b, i) => (
              <div key={i} className="rounded bg-ink-50 px-3 py-2">
                <p className="text-[10px] text-ink-400 capitalize">{b.platform} · {b.content_type}</p>
                <p className="font-medium text-ink-900">
                  {((b.median_engagement_rate ?? 0) * 100).toFixed(2)}%
                </p>
                <p className="text-[10px] text-ink-400">n={b.sample_size}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-400">
          Patrones activos ({typedPatterns.length})
        </h2>
        {typedPatterns.length === 0 && (
          <p className="mt-3 text-sm text-ink-400">
            Aún no hay patrones. Cuando un post supere la mediana del cliente, se marcará automáticamente.
            O puedes marcarlo manualmente más abajo.
          </p>
        )}
        <div className="mt-3 space-y-3">
          {typedPatterns.map((p) => {
            const f = p.features ?? {}
            const badge = sourceBadge[p.source] ?? { label: p.source, cls: 'bg-ink-100 text-ink-600' }
            return (
              <div key={p.id} className="rounded-lg border border-ink-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.cls}`}>
                        {badge.label}
                      </span>
                      {f.content_type && (
                        <span className="text-[11px] text-ink-500">{f.content_type}</span>
                      )}
                      {f.angle && (
                        <span className="text-[11px] text-ink-500">· {f.angle}</span>
                      )}
                      {f.platform && (
                        <span className="text-[11px] text-ink-500">· {f.platform}</span>
                      )}
                      {p.impact_multiplier && (
                        <span className="text-[11px] font-medium text-green-700">
                          ×{Number(p.impact_multiplier).toFixed(1)} sobre baseline
                        </span>
                      )}
                    </div>

                    {f.hook && (
                      <p className="mt-2 text-sm text-ink-900">
                        <span className="text-[10px] uppercase text-ink-400">Gancho:</span> &ldquo;{f.hook}&rdquo;
                      </p>
                    )}

                    {p.manual_reason && (
                      <p className="mt-2 rounded bg-yellow-50 px-3 py-2 text-sm text-ink-800 border border-yellow-100">
                        <span className="text-[10px] uppercase text-yellow-700">Tu nota:</span> {p.manual_reason}
                      </p>
                    )}

                    <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-ink-500">
                      {f.publish_hour && <span>🕐 {f.publish_hour}h</span>}
                      {f.weekday && <span>📅 {weekdayLabel[f.weekday] ?? f.weekday}</span>}
                      {f.has_cta && <span>📣 con CTA</span>}
                      {p.metrics_snapshot?.engagement_rate != null && (
                        <span>📊 {(Number(p.metrics_snapshot.engagement_rate) * 100).toFixed(1)}% engagement</span>
                      )}
                      <span>· hace {Math.floor((Date.now() - new Date(p.created_at).getTime()) / 86400000)}d</span>
                    </div>
                  </div>

                  <ArchivePatternButton patternId={p.id} />
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-400">
          Posts publicados recientes
        </h2>
        <p className="mt-1 text-[11px] text-ink-400">
          Marca manualmente los que hayan funcionado bien, aunque las métricas aún no estén.
        </p>
        <div className="mt-3 space-y-2">
          {typedPosts.length === 0 && (
            <p className="text-sm text-ink-400">Aún no hay posts publicados.</p>
          )}
          {typedPosts.map((post) => (
            <div key={post.id} className="rounded-lg border border-ink-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] text-ink-500 capitalize">{post.platform}</span>
                    {post.published_at && (
                      <span className="text-[11px] text-ink-400">
                        {new Date(post.published_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                    {post.is_winner && (
                      <span className="rounded-full bg-yellow-100 text-yellow-800 px-2 py-0.5 text-[10px] font-medium">
                        ⭐ ganador
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-ink-800 line-clamp-3">{post.copy}</p>
                  <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-ink-500">
                    {post.reach != null && <span>👁 {post.reach.toLocaleString('es-ES')}</span>}
                    {post.engagement_rate != null && (
                      <span>📊 {(Number(post.engagement_rate) * 100).toFixed(1)}%</span>
                    )}
                    {post.external_url && (
                      <a href={post.external_url} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
                        Ver post →
                      </a>
                    )}
                  </div>
                </div>
                <MarkWinnerButton postId={post.id} alreadyWinner={post.is_winner} />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
