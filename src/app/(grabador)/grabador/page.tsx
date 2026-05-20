import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/getUser'

export default async function GrabadorPage() {
  const { user } = await getAuthUser()
  const supabase = await createClient()

  const { data: tasks } = await supabase
    .from('content_tasks')
    .select('id, title, status, deadline, recording_brief, client_id')
    .eq('grabador_id', user.id)
    .in('status', ['approved_idea', 'brief_sent', 'recording'])
    .order('deadline', { ascending: true })

  return (
    <div className="p-8">
      <h1 className="font-serif text-3xl text-ink-900">Mis grabaciones</h1>

      {!tasks?.length && (
        <p className="mt-6 text-sm text-ink-500">No tienes grabaciones pendientes.</p>
      )}

      <div className="mt-6 space-y-3">
        {tasks?.map((task) => {
          const brief = task.recording_brief as { concept?: string; deadline?: string } | null
          return (
            <a
              key={task.id}
              href={`/grabador/tasks/${task.id}`}
              className="flex items-center justify-between rounded-lg border border-ink-200 bg-white px-5 py-4 hover:border-ink-300"
            >
              <div>
                <p className="font-medium text-ink-900">{task.title}</p>
                <p className="mt-0.5 text-xs text-ink-500">
                  {brief?.concept ?? ''}
                </p>
              </div>
              <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-xs text-ink-600">
                {task.status}
              </span>
            </a>
          )
        })}
      </div>
    </div>
  )
}
