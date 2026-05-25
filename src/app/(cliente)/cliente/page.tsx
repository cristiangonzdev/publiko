import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/getUser'
import Link from 'next/link'

const STATUS_COLOR: Record<string, string> = {
  approved: 'bg-blue-50 text-blue-700',
  scheduled: 'bg-purple-50 text-purple-700',
  published: 'bg-green-50 text-green-700',
  editing: 'bg-yellow-50 text-yellow-700',
  delivered: 'bg-orange-50 text-orange-700',
}
const STATUS_LABEL: Record<string, string> = {
  approved: 'Aprobado', scheduled: 'Programado', published: 'Publicado',
  editing: 'En edición', delivered: 'En revisión',
}

interface PostRow {
  id: string; copy: string; platform: string; status: string
  published_at: string | null; scheduled_at: string | null
  reach: number | null; likes: number | null; engagement_rate: number | null
}
interface TaskRow {
  id: string; title: string; status: string; content_type: string
  publish_at: string | null; target_platforms: string[]
}
interface ReportRow {
  id: string; week_start: string; week_end: string; posts_published: number
  total_reach: number | null; avg_engagement_rate: number | null; pdf_url: string | null
}

export default async function ClientePage() {
  const { user } = await getAuthUser()
  const supabase = await createClient()

  const { data: client } = await supabase
    .from('clients')
    .select('id, business_name, current_followers')
    .eq('client_user_id', user.id)
    .single()

  let posts: PostRow[] = []
  let tasks: TaskRow[] = []
  let reports: ReportRow[] = []

  if (client) {
    const [p, t, r] = await Promise.all([
      supabase
        .from('posts')
        .select('id, copy, platform, status, published_at, scheduled_at, reach, likes, engagement_rate')
        .eq('client_id', client.id)
        .order('scheduled_at', { ascending: false })
        .limit(10),
      supabase
        .from('content_tasks')
        .select('id, title, status, content_type, publish_at, target_platforms')
        .eq('client_id', client.id)
        .in('status', ['approved', 'scheduled', 'editing', 'delivered'])
        .order('publish_at', { ascending: true })
        .limit(8),
      supabase
        .from('weekly_reports')
        .select('id, week_start, week_end, posts_published, total_reach, avg_engagement_rate, pdf_url')
        .eq('client_id', client.id)
        .order('week_start', { ascending: false })
        .limit(4),
    ])
    posts = (p.data ?? []) as PostRow[]
    tasks = (t.data ?? []) as TaskRow[]
    reports = (r.data ?? []) as ReportRow[]
  }

  const followers = (client?.current_followers as Record<string, number>) ?? {}

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div>
        <div className="text-xs font-medium uppercase tracking-widest text-brand">Portal</div>
        <h1 className="mt-1 font-serif text-2xl sm:text-3xl text-ink-900">
          {client?.business_name ?? 'Mi contenido'}
        </h1>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Object.entries(followers).map(([platform, count]) => (
          <div key={platform} className="rounded-lg border border-ink-200 bg-white p-4">
            <p className="text-[10px] font-medium uppercase tracking-wide text-ink-400 capitalize">{platform}</p>
            <p className="mt-1 font-serif text-2xl text-ink-900">{count?.toLocaleString('es-ES') ?? '—'}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-sm font-semibold text-ink-700">Esta semana</h2>
          <div className="space-y-3">
            {!tasks.length && (
              <div className="rounded-lg border border-dashed border-ink-200 py-8 text-center text-sm text-ink-400">
                Sin contenido programado próximamente.
              </div>
            )}
            {tasks.map((task) => (
              <div key={task.id} className="rounded-lg border border-ink-200 bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-ink-900">{task.title}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {task.target_platforms.map((p) => (
                        <span key={p} className="rounded bg-ink-100 px-1.5 py-0.5 text-[10px] text-ink-500">{p}</span>
                      ))}
                      <span className="text-[10px] text-ink-400">{task.content_type}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_COLOR[task.status] ?? 'bg-ink-100 text-ink-500'}`}>
                      {STATUS_LABEL[task.status] ?? task.status}
                    </span>
                    {task.publish_at && (
                      <p className="mt-1 text-[10px] text-ink-400">
                        {new Date(task.publish_at).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-ink-700">Publicaciones recientes</h2>
          <div className="space-y-3">
            {!posts.length && (
              <p className="text-sm text-ink-400">Sin publicaciones aún.</p>
            )}
            {posts.map((post) => (
              <div key={post.id} className="rounded-lg border border-ink-200 bg-white px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium uppercase text-ink-400">{post.platform}</span>
                  <div className="flex items-center gap-2 text-[10px] text-ink-400">
                    {post.reach != null && <span>{post.reach.toLocaleString('es-ES')} alcance</span>}
                    {post.likes != null && <span>♥ {post.likes}</span>}
                    {post.engagement_rate != null && <span>{(post.engagement_rate * 100).toFixed(1)}%</span>}
                  </div>
                </div>
                <p className="mt-1.5 text-sm text-ink-700 line-clamp-2">{post.copy}</p>
                {post.published_at && (
                  <p className="mt-1 text-[10px] text-ink-400">
                    {new Date(post.published_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      {reports.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-ink-700">Informes semanales</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {reports.map((report) => (
              <div key={report.id} className="rounded-lg border border-ink-200 bg-white p-4">
                <p className="text-xs font-medium text-ink-700">
                  {new Date(report.week_start).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                  {' – '}
                  {new Date(report.week_end).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-1 text-[11px]">
                  <div>
                    <p className="text-ink-400">Posts</p>
                    <p className="font-medium text-ink-800">{report.posts_published}</p>
                  </div>
                  <div>
                    <p className="text-ink-400">Alcance</p>
                    <p className="font-medium text-ink-800">{report.total_reach?.toLocaleString('es-ES') ?? '—'}</p>
                  </div>
                </div>
                {report.pdf_url && (
                  <a
                    href={report.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 block text-center text-xs text-brand hover:underline"
                  >
                    Descargar PDF →
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="mt-8 flex gap-3">
        <Link
          href="/cliente/assets"
          className="rounded-md border border-ink-200 bg-white px-4 py-2 text-sm text-ink-700 hover:bg-ink-50"
        >
          Subir assets
        </Link>
        <Link
          href="/cliente/facturas"
          className="rounded-md border border-ink-200 bg-white px-4 py-2 text-sm text-ink-700 hover:bg-ink-50"
        >
          Ver facturas
        </Link>
      </div>
    </div>
  )
}
