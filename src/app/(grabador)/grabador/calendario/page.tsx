import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/getUser'
import { ProductionCalendar } from '@/components/ui/ProductionCalendar'

export default async function GrabadorCalendarioPage() {
  const { user } = await getAuthUser()
  const supabase  = await createClient()

  const { data: tasks } = await supabase
    .from('content_tasks')
    .select('id, title, status, deadline, client_id, content_type, clients!inner(business_name)')
    .eq('grabador_id', user.id)
    .not('status', 'in', '("published","brutos_ready")')
    .not('deadline', 'is', null)
    .order('deadline', { ascending: true })

  const calTasks = (tasks ?? []).map((t) => ({
    id:          t.id,
    title:       t.title,
    status:      t.status,
    deadline:    t.deadline!,
    content_type: t.content_type ?? 'reel',
    client_name: (t.clients as unknown as { business_name: string })?.business_name ?? '',
  }))

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <div className="text-xs font-medium uppercase tracking-widest text-brand">Grabador</div>
        <h1 className="mt-1 font-serif text-3xl text-ink-900">Calendario de grabaciones</h1>
        <p className="mt-1 text-sm text-ink-400">Tus deadlines de grabación para las próximas semanas.</p>
      </div>
      <ProductionCalendar tasks={calTasks} role="grabador" />
    </div>
  )
}
