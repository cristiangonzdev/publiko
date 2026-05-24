import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/getUser'
import { GrabadorTaskCard } from '@/components/grabador/GrabadorTaskCard'
import { WorkloadSummary } from '@/components/ui/WorkloadSummary'

export default async function GrabadorPage() {
  const { user } = await getAuthUser()
  const supabase = await createClient()

  const { data: tasks } = await supabase
    .from('content_tasks')
    .select('id, title, status, deadline, recording_brief, client_id, clients!inner(business_name, drive_folder_id)')
    .eq('grabador_id', user.id)
    .not('status', 'in', '("published","cancelled","delivered","approved")')
    .order('deadline', { ascending: true })

  const folderMap = Object.fromEntries(
    (tasks ?? []).map((t) => [t.client_id, (t.clients as unknown as { drive_folder_id: string | null })?.drive_folder_id ?? null])
  )

  const workloadTasks = (tasks ?? []).map((t) => ({ id: t.id, deadline: t.deadline, status: t.status }))

  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="text-xs font-medium uppercase tracking-widest text-brand">Grabador</div>
        <h1 className="mt-1 font-serif text-3xl text-ink-900">Mis grabaciones</h1>
      </div>

      {!tasks?.length ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-ink-200 py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-ink-50">
            <svg className="h-8 w-8 text-ink-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.867v6.266a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/>
            </svg>
          </div>
          <p className="text-base font-semibold text-ink-700">Sin grabaciones pendientes</p>
          <p className="mt-1.5 max-w-xs text-sm text-ink-400">
            El admin aún no te ha asignado grabaciones. Cuando lo haga, aparecerán aquí con su ficha técnica.
          </p>
        </div>
      ) : (
        <>
          <WorkloadSummary tasks={workloadTasks} role="grabador" />
          <div className="space-y-4">
            {tasks.map((task) => (
              <GrabadorTaskCard
                key={task.id}
                taskId={task.id}
                title={task.title}
                clientName={(task.clients as unknown as { business_name: string })?.business_name ?? ''}
                status={task.status}
                deadline={task.deadline}
                recordingBrief={task.recording_brief as Record<string, unknown> | null}
                driveFolderId={folderMap[task.client_id] ?? null}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
