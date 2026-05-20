import { createClient } from '@/lib/supabase/server'
import { HumanIdeaForm } from '@/components/content/HumanIdeaForm'

export default async function HumanInputPage() {
  const supabase = await createClient()

  const { data: clients } = await supabase
    .from('clients')
    .select('id, business_name')
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('business_name')

  return (
    <div className="p-8 max-w-2xl">
      <div>
        <div className="text-xs font-medium uppercase tracking-widest text-brand">Ideas</div>
        <h1 className="mt-1 font-serif text-3xl text-ink-900">Idea humana</h1>
        <p className="mt-2 text-sm text-ink-500">
          Convierte una historia real o ángulo humano en una idea estructurada con la IA.
        </p>
      </div>

      <HumanIdeaForm clients={(clients ?? []).map((c) => ({ id: c.id, business_name: c.business_name }))} />
    </div>
  )
}
