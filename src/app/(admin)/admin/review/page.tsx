import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/getUser'
import { ReviewList } from '@/components/content/ReviewList'

export default async function ReviewPage() {
  const { role } = await getAuthUser()
  if (role !== 'admin') notFound()

  const supabase = await createClient()

  const { data: tasks } = await supabase
    .from('content_tasks')
    .select('id, title, status, deadline, copy_selected, revision_notes, revision_count, final_asset_id, client_id, target_platforms, publish_at')
    .in('status', ['delivered', 'revision'])
    .order('deadline', { ascending: true })

  const clientIds = [...new Set((tasks ?? []).map((t) => t.client_id))]
  const { data: clients } = await supabase
    .from('clients')
    .select('id, business_name')
    .in('id', clientIds.length > 0 ? clientIds : ['none'])

  const clientMap = Object.fromEntries((clients ?? []).map((c) => [c.id, c.business_name]))

  const items = (tasks ?? []).map((t) => ({
    ...t,
    business_name: clientMap[t.client_id] ?? t.client_id,
  }))

  return (
    <div className="p-4 md:p-8">
      <div>
        <div className="text-xs font-medium uppercase tracking-widest text-brand">Revisión</div>
        <h1 className="mt-1 font-serif text-3xl text-ink-900">Entregables pendientes</h1>
        <p className="mt-1 text-sm text-ink-500">{items.length} esperando revisión</p>
      </div>

      <ReviewList initialItems={items} />
    </div>
  )
}
