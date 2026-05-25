import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { IdeasBoard } from '@/components/content/IdeasBoard'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ClientIdeasPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: client }, { data: ideas }, { data: brain }, { data: team }] = await Promise.all([
    supabase.from('clients').select('id, business_name').eq('id', id).single(),
    supabase
      .from('content_ideas')
      .select('*')
      .eq('client_id', id)
      .order('created_at', { ascending: false }),
    supabase.from('brand_brains').select('onboarding_completed').eq('client_id', id).single(),
    supabase
      .from('profiles')
      .select('id, full_name, role')
      .in('role', ['grabador', 'editor'])
      .eq('is_active', true),
  ])

  if (!client) notFound()

  const grabadores = (team ?? []).filter((p) => p.role === 'grabador').map((p) => ({ id: p.id, full_name: p.full_name }))
  const editores = (team ?? []).filter((p) => p.role === 'editor').map((p) => ({ id: p.id, full_name: p.full_name }))

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-widest text-brand">Ideas</div>
          <h1 className="mt-1 font-serif text-2xl sm:text-3xl text-ink-900">{client.business_name}</h1>
        </div>
      </div>

      <IdeasBoard
        clientId={id}
        initialIdeas={(ideas ?? []) as unknown as Array<Record<string, unknown>>}
        brandBrainCompleted={brain?.onboarding_completed ?? false}
        grabadores={grabadores}
        editores={editores}
      />
    </div>
  )
}
