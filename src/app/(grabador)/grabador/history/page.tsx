import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/getUser'
import { redirect } from 'next/navigation'

export default async function GrabadorHistoryPage() {
  const { user, role } = await getAuthUser()
  if (role !== 'grabador') redirect('/login')

  const supabase = await createClient()

  const { data: tasks } = await supabase
    .from('content_tasks')
    .select('id, client_id, title, status, content_type, deadline, updated_at')
    .eq('grabador_id', user.id)
    .in('status', ['brutos_ready', 'editing', 'delivered', 'approved', 'scheduled', 'published'])
    .order('updated_at', { ascending: false })
    .limit(50)

  const clientIds = [...new Set((tasks ?? []).map((t) => t.client_id))]
  const { data: clients } = await supabase
    .from('clients')
    .select('id, business_name')
    .in('id', clientIds)

  const clientMap = Object.fromEntries((clients ?? []).map((c) => [c.id, c.business_name]))

  const STATUS_LABEL: Record<string, string> = {
    brutos_ready: 'Brutos listos',
    editing: 'En edición',
    delivered: 'Entregado',
    approved: 'Aprobado',
    scheduled: 'Programado',
    published: 'Publicado',
  }

  const STATUS_COLOR: Record<string, string> = {
    brutos_ready: 'bg-purple-50 text-purple-700',
    editing: 'bg-orange-50 text-orange-700',
    delivered: 'bg-pink-50 text-pink-700',
    approved: 'bg-green-50 text-green-700',
    scheduled: 'bg-teal-50 text-teal-700',
    published: 'bg-blue-50 text-blue-700',
  }

  const taskList = tasks ?? []

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div>
        <div className="text-xs font-medium uppercase tracking-widest text-brand">Grabador</div>
        <h1 className="mt-1 font-serif text-2xl sm:text-3xl text-ink-900">Historial de grabaciones</h1>
      </div>

      {/* Mobile: cards */}
      <div className="mt-6 space-y-3 md:hidden">
        {!taskList.length && (
          <p className="rounded-lg border border-dashed border-ink-200 py-8 text-center text-sm text-ink-400">
            Aún no tienes grabaciones completadas.
          </p>
        )}
        {taskList.map((t) => (
          <div key={t.id} className="rounded-lg border border-ink-200 bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-medium text-brand">{clientMap[t.client_id] ?? t.client_id}</p>
                <p className="mt-0.5 text-sm font-medium text-ink-800">{t.title}</p>
                <p className="mt-0.5 text-[11px] text-ink-500">{t.content_type}</p>
              </div>
              <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_COLOR[t.status] ?? 'bg-ink-100 text-ink-500'}`}>
                {STATUS_LABEL[t.status] ?? t.status}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] text-ink-400">
              <span>Deadline: {t.deadline ? new Date(t.deadline).toLocaleDateString('es-ES') : '—'}</span>
              <span>{t.updated_at ? new Date(t.updated_at).toLocaleDateString('es-ES') : '—'}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: table */}
      <div className="mt-6 hidden md:block overflow-x-auto rounded-lg border border-ink-200 bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-ink-200 bg-ink-50">
            <tr>
              {['Cliente · Tarea', 'Tipo', 'Estado', 'Deadline', 'Última actualización'].map((h) => (
                <th key={h} className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-400">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {!taskList.length && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-ink-400">
                  Aún no tienes grabaciones completadas.
                </td>
              </tr>
            )}
            {taskList.map((t) => (
              <tr key={t.id} className="hover:bg-ink-50">
                <td className="px-3 py-3 max-w-[220px]">
                  <p className="text-[10px] font-medium text-brand">{clientMap[t.client_id] ?? t.client_id}</p>
                  <p className="truncate font-medium text-ink-800">{t.title}</p>
                </td>
                <td className="px-3 py-3 text-[11px] text-ink-500">{t.content_type}</td>
                <td className="px-3 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_COLOR[t.status] ?? 'bg-ink-100 text-ink-500'}`}>
                    {STATUS_LABEL[t.status] ?? t.status}
                  </span>
                </td>
                <td className="px-3 py-3 text-xs text-ink-500">
                  {t.deadline ? new Date(t.deadline).toLocaleDateString('es-ES') : '—'}
                </td>
                <td className="px-3 py-3 text-xs text-ink-500">
                  {t.updated_at ? new Date(t.updated_at).toLocaleDateString('es-ES') : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
