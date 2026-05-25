import { createClient } from '@/lib/supabase/server'
import { TasksManager } from '@/components/admin/TasksManager'

export default async function AdminTasksPage() {
  const supabase = await createClient()

  const [{ data: tasks }, { data: clients }, { data: team }] = await Promise.all([
    supabase
      .from('content_tasks')
      .select('id, client_id, title, status, content_type, deadline, grabador_id, editor_id, target_platforms, publish_at')
      .not('status', 'in', '("published","cancelled")')
      .order('deadline', { ascending: true })
      .limit(100),
    supabase
      .from('clients')
      .select('id, business_name')
      .eq('status', 'active')
      .is('deleted_at', null),
    supabase
      .from('profiles')
      .select('id, full_name, role')
      .in('role', ['grabador', 'editor'])
      .eq('is_active', true),
  ])

  const clientMap = Object.fromEntries((clients ?? []).map((c) => [c.id, c.business_name]))
  const grabadores = (team ?? []).filter((p) => p.role === 'grabador')
  const editores = (team ?? []).filter((p) => p.role === 'editor')

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div>
        <div className="text-xs font-medium uppercase tracking-widest text-brand">Producción</div>
        <h1 className="mt-1 font-serif text-2xl sm:text-3xl text-ink-900">Tareas</h1>
      </div>

      <TasksManager
        initialTasks={(tasks ?? []).map((t) => ({ ...t, business_name: clientMap[t.client_id] ?? t.client_id }))}
        grabadores={grabadores.map((p) => ({ id: p.id, full_name: p.full_name }))}
        editores={editores.map((p) => ({ id: p.id, full_name: p.full_name }))}
      />
    </div>
  )
}
