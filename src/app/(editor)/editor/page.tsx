import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/getUser'
import { EditorKanban } from '@/components/editor/EditorKanban'
import { WorkloadSummary } from '@/components/ui/WorkloadSummary'

export default async function EditorPage() {
  const { user } = await getAuthUser()
  const supabase = await createClient()

  const { data: tasks } = await supabase
    .from('content_tasks')
    .select('id, title, status, deadline, client_id, content_type, copy_selected, editing_brief, final_asset_id, clients!inner(business_name)')
    .eq('editor_id', user.id)
    .not('status', 'in', '("published")')
    .order('deadline', { ascending: true })

  const kanbanTasks = (tasks ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    client_id: t.client_id,
    client_name: (t.clients as unknown as { business_name: string })?.business_name ?? '',
    status: t.status,
    deadline: t.deadline,
    content_type: t.content_type,
    copy_selected: t.copy_selected,
    editing_brief: t.editing_brief as Record<string, unknown> | null,
    final_asset_id: t.final_asset_id,
  }))

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <div className="text-xs font-medium uppercase tracking-widest text-brand">Editor</div>
        <h1 className="mt-1 font-serif text-2xl sm:text-3xl text-ink-900">Mis tareas</h1>
      </div>

      {kanbanTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-ink-200 py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-ink-50">
            <svg className="h-8 w-8 text-ink-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
          </div>
          <p className="text-base font-semibold text-ink-700">Sin tareas asignadas</p>
          <p className="mt-1.5 max-w-xs text-sm text-ink-400">
            El admin aún no te ha asignado tareas de edición. Cuando lo haga, aparecerán aquí en tu kanban.
          </p>
        </div>
      ) : (
        <>
          <WorkloadSummary tasks={kanbanTasks} role="editor" />
          <EditorKanban initialTasks={kanbanTasks} />
        </>
      )}
    </div>
  )
}
