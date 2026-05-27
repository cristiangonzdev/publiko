import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/getUser'
import { redirect } from 'next/navigation'

export default async function EditorDeliveredPage() {
  const { user, role } = await getAuthUser()
  if (role !== 'editor') redirect('/login')

  const supabase = await createClient()

  const { data: tasks } = await supabase
    .from('content_tasks')
    .select('id, client_id, title, status, content_type, deadline, publish_at, created_at')
    .eq('editor_id', user.id)
    .in('status', ['delivered', 'approved', 'scheduled', 'published'])
    .order('updated_at', { ascending: false })
    .limit(50)

  const clientIds = [...new Set((tasks ?? []).map((t) => t.client_id))]
  const { data: clients } = await supabase
    .from('clients')
    .select('id, business_name')
    .in('id', clientIds)

  const clientMap = Object.fromEntries((clients ?? []).map((c) => [c.id, c.business_name]))

  const STATUS_LABEL: Record<string, string> = {
    delivered: 'Entregado',
    approved: 'Aprobado',
    scheduled: 'Programado',
    published: 'Publicado',
  }
  const STATUS_COLOR: Record<string, string> = {
    delivered: 'bg-pink-50 text-pink-700',
    approved: 'bg-green-50 text-green-700',
    scheduled: 'bg-teal-50 text-teal-700',
    published: 'bg-blue-50 text-blue-700',
  }

  return (
    <div className="p-4 md:p-8">
      <div>
        <div className="text-xs font-medium uppercase tracking-widest text-brand">Editor</div>
        <h1 className="mt-1 font-serif text-3xl text-ink-900">Historial entregados</h1>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-ink-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-ink-200 bg-ink-50">
            <tr>
              {['Cliente · Tarea', 'Tipo', 'Estado', 'Deadline', 'Publicación'].map((h) => (
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
                  Aún no has entregado ningún vídeo.
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
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_COLOR[t.status] ?? 'bg-ink-100 text-ink-500'}`}>
                    {STATUS_LABEL[t.status] ?? t.status}
                  </span>
                </td>
                <td className="px-3 py-3 text-xs text-ink-500">
                  {t.deadline ? new Date(t.deadline).toLocaleDateString('es-ES') : '—'}
                </td>
                <td className="px-3 py-3 text-xs text-ink-500">
                  {t.publish_at ? new Date(t.publish_at).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
