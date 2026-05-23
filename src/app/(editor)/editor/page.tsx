import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/getUser'
import { EditorKanban } from '@/components/editor/EditorKanban'

export default async function EditorPage() {
  const { user } = await getAuthUser()
  const supabase = await createClient()

  const { data: tasks } = await supabase
    .from('content_tasks')
    .select('id, title, status, deadline, client_id, content_type, copy_selected, editing_brief, final_asset_id, clients!inner(business_name)')
    .eq('editor_id', user.id)
    .not('status', 'in', '("published","cancelled")')
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
    <div className="p-8">
      <div>
        <div className="text-xs font-medium uppercase tracking-widest text-brand">Editor</div>
        <h1 className="mt-1 font-serif text-3xl text-ink-900">Mis tareas</h1>
      </div>

      {kanbanTasks.length === 0 ? (
        <p className="mt-8 text-sm text-ink-500">No tienes tareas asignadas.</p>
      ) : (
        <EditorKanban initialTasks={kanbanTasks} />
      )}
    </div>
  )
}
