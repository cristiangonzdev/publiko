import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface StuckIdea {
  id: string
  client_id: string
  concept: string
  content_type: string
  created_at: string
}

interface StuckTask {
  id: string
  client_id: string
  title: string
  content_type: string
  status: string
  deadline: string | null
  grabador_id: string | null
  editor_id: string | null
  created_at: string
  bruto_uploaded_at: string | null
  delivered_at: string | null
}

interface FailedPost {
  id: string
  client_id: string
  platform: string
  copy: string
  status: string
  failure_reason: string | null
  retry_count: number | null
  scheduled_retry_at: string | null
  last_attempt_at: string | null
  failed_at: string | null
  task_id: string | null
}

function relativeTime(iso: string | null): string {
  if (!iso) return '—'
  const ms = Date.now() - new Date(iso).getTime()
  const h = Math.floor(ms / 3_600_000)
  if (h < 1) return `${Math.max(1, Math.floor(ms / 60_000))} min`
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

function futureTime(iso: string | null): string {
  if (!iso) return '—'
  const ms = new Date(iso).getTime() - Date.now()
  if (ms < 0) return 'ya'
  const m = Math.floor(ms / 60_000)
  if (m < 60) return `en ${m}min`
  return `en ${Math.floor(m / 60)}h`
}

export default async function AtascadoPage() {
  const supabase = await createClient()
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const [
    { data: stuckIdeasRaw },
    { data: tasksNoGrabadorRaw },
    { data: tasksNoEditorRaw },
    { data: deliverablesPendingRaw },
    { data: overdueTasksRaw },
    { data: failedPostsRaw },
    { data: retryPostsRaw },
  ] = await Promise.all([
    supabase
      .from('content_ideas')
      .select('id, client_id, concept, content_type, created_at')
      .eq('status', 'suggested')
      .lte('created_at', dayAgo)
      .order('created_at', { ascending: true })
      .limit(20),

    supabase
      .from('content_tasks')
      .select('id, client_id, title, content_type, status, deadline, grabador_id, editor_id, created_at, bruto_uploaded_at, delivered_at')
      .in('status', ['approved_idea', 'brief_sent'])
      .is('grabador_id', null)
      .order('created_at', { ascending: true })
      .limit(20),

    supabase
      .from('content_tasks')
      .select('id, client_id, title, content_type, status, deadline, grabador_id, editor_id, created_at, bruto_uploaded_at, delivered_at')
      .eq('status', 'brutos_ready')
      .is('editor_id', null)
      .order('bruto_uploaded_at', { ascending: true })
      .limit(20),

    supabase
      .from('content_tasks')
      .select('id, client_id, title, content_type, status, deadline, grabador_id, editor_id, created_at, bruto_uploaded_at, delivered_at')
      .eq('status', 'delivered')
      .order('delivered_at', { ascending: true })
      .limit(20),

    supabase
      .from('content_tasks')
      .select('id, client_id, title, content_type, status, deadline, grabador_id, editor_id, created_at, bruto_uploaded_at, delivered_at')
      .not('status', 'in', '("published")')
      .lt('deadline', new Date().toISOString())
      .not('deadline', 'is', null)
      .order('deadline', { ascending: true })
      .limit(20),

    (supabase.from('posts') as any)
      .select('id, client_id, platform, copy, status, failure_reason, retry_count, scheduled_retry_at, last_attempt_at, failed_at, task_id')
      .eq('status', 'failed')
      .order('failed_at', { ascending: false })
      .limit(20),

    (supabase.from('posts') as any)
      .select('id, client_id, platform, copy, status, failure_reason, retry_count, scheduled_retry_at, last_attempt_at, failed_at, task_id')
      .eq('status', 'scheduled')
      .not('scheduled_retry_at', 'is', null)
      .order('scheduled_retry_at', { ascending: true })
      .limit(20),
  ])
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const stuckIdeas = (stuckIdeasRaw ?? []) as unknown as StuckIdea[]
  const tasksNoGrabador = (tasksNoGrabadorRaw ?? []) as unknown as StuckTask[]
  const tasksNoEditor = (tasksNoEditorRaw ?? []) as unknown as StuckTask[]
  const deliverablesPending = (deliverablesPendingRaw ?? []) as unknown as StuckTask[]
  const overdueTasks = (overdueTasksRaw ?? []) as unknown as StuckTask[]
  const failedPosts = (failedPostsRaw ?? []) as unknown as FailedPost[]
  const retryPosts = (retryPostsRaw ?? []) as unknown as FailedPost[]

  const allClientIds = [...new Set([
    ...stuckIdeas.map((x) => x.client_id),
    ...tasksNoGrabador.map((x) => x.client_id),
    ...tasksNoEditor.map((x) => x.client_id),
    ...deliverablesPending.map((x) => x.client_id),
    ...overdueTasks.map((x) => x.client_id),
    ...failedPosts.map((x) => x.client_id),
    ...retryPosts.map((x) => x.client_id),
  ])]

  const { data: clientNames } = await supabase
    .from('clients').select('id, business_name').in('id', allClientIds)
  const cMap = Object.fromEntries((clientNames ?? []).map((c) => [c.id, c.business_name]))

  const totalBlocked =
    stuckIdeas.length + tasksNoGrabador.length + tasksNoEditor.length +
    deliverablesPending.length + overdueTasks.length + failedPosts.length

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-widest text-brand">Operación</div>
          <h1 className="mt-1 font-serif text-2xl sm:text-3xl text-ink-900">Qué está atascado</h1>
          <p className="mt-1 text-sm text-ink-500">
            Todo lo que necesita una acción tuya o de alguien del equipo, en un sitio.
          </p>
        </div>
        <div className="self-start rounded-xl border border-ink-200 bg-white px-5 py-3 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-400">Items bloqueados</p>
          <p className={`mt-1 font-serif text-2xl sm:text-3xl ${totalBlocked === 0 ? 'text-green-600' : 'text-ink-900'}`}>
            {totalBlocked}
          </p>
        </div>
      </div>

      {totalBlocked === 0 && (
        <div className="mt-8 rounded-xl border border-green-200 bg-green-50 p-6 text-center">
          <p className="text-green-700">✓ Pipeline limpio. Nada bloqueado ahora mismo.</p>
        </div>
      )}

      {failedPosts.length > 0 && (
        <Section title="🚨 Publicaciones falladas (3+ intentos)" tone="red">
          {failedPosts.map((p) => (
            <Row
              key={p.id}
              client={cMap[p.client_id]}
              primary={`${p.platform} — ${p.copy.slice(0, 80)}${p.copy.length > 80 ? '…' : ''}`}
              secondary={`Error: ${p.failure_reason ?? 'desconocido'}`}
              meta={`hace ${relativeTime(p.failed_at)}`}
              href={p.task_id ? `/admin/tasks/${p.task_id}` : `/admin/clients/${p.client_id}`}
              tone="red"
            />
          ))}
        </Section>
      )}

      {retryPosts.length > 0 && (
        <Section title="⏳ Publicaciones reintentando" tone="yellow">
          {retryPosts.map((p) => (
            <Row
              key={p.id}
              client={cMap[p.client_id]}
              primary={`${p.platform} — ${p.copy.slice(0, 80)}${p.copy.length > 80 ? '…' : ''}`}
              secondary={`Intento ${(p.retry_count ?? 0) + 1}/3 · próximo ${futureTime(p.scheduled_retry_at)} · Error: ${p.failure_reason ?? ''}`}
              meta={`último intento hace ${relativeTime(p.last_attempt_at)}`}
              href={p.task_id ? `/admin/tasks/${p.task_id}` : `/admin/clients/${p.client_id}`}
              tone="yellow"
            />
          ))}
        </Section>
      )}

      {overdueTasks.length > 0 && (
        <Section title="⌛ Tareas vencidas (deadline pasado)" tone="red">
          {overdueTasks.map((t) => (
            <Row
              key={t.id}
              client={cMap[t.client_id]}
              primary={t.title}
              secondary={`Estado: ${t.status} · ${t.content_type}`}
              meta={`venció hace ${relativeTime(t.deadline)}`}
              href={`/admin/tasks/${t.id}`}
              tone="red"
            />
          ))}
        </Section>
      )}

      {deliverablesPending.length > 0 && (
        <Section title="🎬 Entregables esperando tu aprobación" tone="yellow">
          {deliverablesPending.map((t) => (
            <Row
              key={t.id}
              client={cMap[t.client_id]}
              primary={t.title}
              secondary={t.content_type}
              meta={`entregado hace ${relativeTime(t.delivered_at)}`}
              href={`/admin/review`}
              tone="yellow"
            />
          ))}
        </Section>
      )}

      {tasksNoEditor.length > 0 && (
        <Section title="🎞 Brutos sin editor asignado" tone="orange">
          {tasksNoEditor.map((t) => (
            <Row
              key={t.id}
              client={cMap[t.client_id]}
              primary={t.title}
              secondary={t.content_type}
              meta={`bruto subido hace ${relativeTime(t.bruto_uploaded_at)}`}
              href={`/admin/tasks/${t.id}`}
              tone="orange"
            />
          ))}
        </Section>
      )}

      {tasksNoGrabador.length > 0 && (
        <Section title="📹 Tareas sin grabador asignado" tone="orange">
          {tasksNoGrabador.map((t) => (
            <Row
              key={t.id}
              client={cMap[t.client_id]}
              primary={t.title}
              secondary={t.content_type}
              meta={`creada hace ${relativeTime(t.created_at)}`}
              href={`/admin/tasks/${t.id}`}
              tone="orange"
            />
          ))}
        </Section>
      )}

      {stuckIdeas.length > 0 && (
        <Section title="💡 Ideas sin aprobar más de 24h" tone="blue">
          {stuckIdeas.map((i) => (
            <Row
              key={i.id}
              client={cMap[i.client_id]}
              primary={i.concept}
              secondary={i.content_type}
              meta={`generada hace ${relativeTime(i.created_at)}`}
              href={`/admin/clients/${i.client_id}/ideas`}
              tone="blue"
            />
          ))}
        </Section>
      )}
    </div>
  )
}

const toneStyles: Record<string, { border: string; bg: string; meta: string }> = {
  red: { border: 'border-red-200', bg: 'bg-red-50', meta: 'text-red-600' },
  yellow: { border: 'border-yellow-200', bg: 'bg-yellow-50', meta: 'text-yellow-700' },
  orange: { border: 'border-orange-200', bg: 'bg-orange-50', meta: 'text-orange-700' },
  blue: { border: 'border-blue-200', bg: 'bg-blue-50', meta: 'text-blue-700' },
}

function Section({ title, children, tone }: { title: string; children: React.ReactNode; tone: keyof typeof toneStyles }) {
  const s = toneStyles[tone]
  return (
    <section className={`mt-6 rounded-xl border ${s.border} bg-white`}>
      <div className={`flex items-center justify-between px-4 py-3 ${s.bg} border-b ${s.border} rounded-t-xl`}>
        <h2 className="text-sm font-semibold text-ink-800">{title}</h2>
      </div>
      <ul className="divide-y divide-ink-50">
        {children}
      </ul>
    </section>
  )
}

function Row({ client, primary, secondary, meta, href, tone }: {
  client: string | undefined
  primary: string
  secondary?: string
  meta: string
  href: string
  tone: keyof typeof toneStyles
}) {
  return (
    <li>
      <Link href={href} className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-ink-50/50">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-brand">{client ?? '—'}</p>
          <p className="text-sm text-ink-900 truncate">{primary}</p>
          {secondary && <p className="text-xs text-ink-500 truncate">{secondary}</p>}
        </div>
        <span className={`text-[11px] flex-shrink-0 ${toneStyles[tone].meta}`}>{meta}</span>
      </Link>
    </li>
  )
}
