import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/getUser'

export default async function EditorPage() {
  const { user } = await getAuthUser()
  const supabase = await createClient()

  const { data: tasks } = await supabase
    .from('content_tasks')
    .select('id, title, status, deadline, client_id')
    .eq('editor_id', user.id)
    .not('status', 'in', '("published","cancelled")')
    .order('deadline', { ascending: true })

  return (
    <div className="p-8">
      <h1 className="font-serif text-3xl text-ink-900">Mis tareas</h1>

      {!tasks?.length && (
        <p className="mt-6 text-sm text-ink-500">No tienes tareas asignadas.</p>
      )}

      <div className="mt-6 space-y-3">
        {tasks?.map((task) => (
          <a
            key={task.id}
            href={`/editor/tasks/${task.id}`}
            className="flex items-center justify-between rounded-lg border border-ink-200 bg-white px-5 py-4 hover:border-ink-300"
          >
            <div>
              <p className="font-medium text-ink-900">{task.title}</p>
              <p className="mt-0.5 text-xs text-ink-400">{task.client_id.slice(0, 8)}</p>
            </div>
            <div className="text-right">
              <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-xs text-ink-600">
                {task.status}
              </span>
              {task.deadline && (
                <p className="mt-1 text-xs text-ink-400">
                  {new Date(task.deadline).toLocaleDateString('es-ES')}
                </p>
              )}
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}
