import { createClient } from '@/lib/supabase/server'
import { PipelineBoard } from '@/components/crm/PipelineBoard'

export default async function PipelinePage() {
  const supabase = await createClient()

  const { data: clients } = await supabase
    .from('clients')
    .select('id, business_name, status, monthly_fee, contact_name, pipeline_notes, updated_at')
    .not('status', 'in', '("churned")')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })

  const totalMRR = (clients ?? [])
    .filter((c) => c.status === 'active')
    .reduce((sum, c) => sum + (c.monthly_fee ?? 0), 0)

  const pipelineValue = (clients ?? [])
    .filter((c) => ['lead', 'proposal_sent', 'negotiation'].includes(c.status))
    .reduce((sum, c) => sum + (c.monthly_fee ?? 0), 0)

  return (
    <div className="p-8">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-widest text-brand">CRM</div>
          <h1 className="mt-1 font-serif text-3xl text-ink-900">Pipeline</h1>
        </div>
        <div className="flex gap-4 text-right">
          <div>
            <p className="text-xs text-ink-400">MRR activo</p>
            <p className="font-serif text-2xl text-green-600">{totalMRR.toLocaleString('es-ES')} €</p>
          </div>
          <div>
            <p className="text-xs text-ink-400">Valor pipeline</p>
            <p className="font-serif text-2xl text-blue-600">{pipelineValue.toLocaleString('es-ES')} €</p>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <PipelineBoard initialClients={(clients ?? []).map((c) => ({
          id: c.id,
          business_name: c.business_name,
          status: c.status,
          monthly_fee: c.monthly_fee ?? 0,
          contact_name: c.contact_name,
          pipeline_notes: c.pipeline_notes,
          updated_at: c.updated_at,
        }))} />
      </div>
    </div>
  )
}
