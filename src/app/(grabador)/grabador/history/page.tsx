import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/getUser'
import { contentStatusStyle } from '@/lib/status'
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

  return (
    <div className="p-4 md:p-8">
      <div>
        <div className="text-xs font-medium uppercase tracking-widest text-brand">Grabador</div>
        <h1 className="mt-1 font-serif text-3xl text-ink-900">Historial de grabaciones</h1>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-ink-200 bg-white">
        <table className="w-full text-sm">
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
            {!(tasks ?? []).length && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-ink-400">
                  Aún no tienes grabaciones completadas.
                </td>
              </tr>
            )}
            {(tasks ?? []).map((t) => (
              <tr key={t.id} className="hover:bg-ink-50">
                <td className="px-3 py-3 max-w-[220px]">
                  <p className="text-[10px] font-medium text-brand">{clientMap[t.client_id] ?? t.client_id}</p>
                  <p className="truncate font-medium text-ink-800">{t.title}</p>
                </td>
                <td className="px-3 py-3 text-[11px] text-ink-500">{t.content_type}</td>
                <td className="px-3 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${contentStatusStyle(t.status).badge}`}>
                    {contentStatusStyle(t.status).label}
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
