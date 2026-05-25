import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/getUser'
import { GrabadorTaskCard } from '@/components/grabador/GrabadorTaskCard'

export default async function GrabadorPage() {
  const { user } = await getAuthUser()
  const supabase = await createClient()

  const { data: tasks } = await supabase
    .from('content_tasks')
    .select('id, title, status, deadline, recording_brief, client_id')
    .eq('grabador_id', user.id)
    .not('status', 'in', '("published","cancelled","delivered","approved")')
    .order('deadline', { ascending: true })

  const { data: clients } = await supabase
    .from('clients')
    .select('id, drive_folder_id')

  const folderMap = Object.fromEntries((clients ?? []).map((c) => [c.id, c.drive_folder_id]))

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div>
        <div className="text-xs font-medium uppercase tracking-widest text-brand">Grabador</div>
        <h1 className="mt-1 font-serif text-2xl sm:text-3xl text-ink-900">Mis grabaciones</h1>
      </div>

      {!tasks?.length ? (
        <p className="mt-8 text-sm text-ink-500">No tienes grabaciones pendientes.</p>
      ) : (
        <div className="mt-6 space-y-4">
          {tasks.map((task) => (
            <GrabadorTaskCard
              key={task.id}
              taskId={task.id}
              title={task.title}
              status={task.status}
              deadline={task.deadline}
              recordingBrief={task.recording_brief as Record<string, unknown> | null}
              driveFolderId={folderMap[task.client_id] ?? null}
            />
          ))}
        </div>
      )}
    </div>
  )
}
