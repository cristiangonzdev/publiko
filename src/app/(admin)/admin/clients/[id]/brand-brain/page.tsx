import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BrandBrainForm } from '@/components/brand-brain/BrandBrainForm'

interface Props {
  params: Promise<{ id: string }>
}

export default async function BrandBrainPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: client }, { data: brain }] = await Promise.all([
    supabase.from('clients').select('id, business_name').eq('id', id).single(),
    supabase.from('brand_brains').select('*').eq('client_id', id).single(),
  ])

  if (!client) notFound()

  return (
    <div className="mx-auto max-w-3xl p-8">
      <div className="mb-2 text-xs font-medium uppercase tracking-widest text-brand">Brand Brain</div>
      <h1 className="font-serif text-3xl text-ink-900">{client.business_name}</h1>
      <p className="mt-1 text-sm text-ink-500">
        Rellena las 6 secciones. Se guarda automáticamente.
      </p>

      <BrandBrainForm
        clientId={id}
        initialData={brain ?? undefined}
        isCompleted={brain?.onboarding_completed ?? false}
        currentStep={brain?.onboarding_step ?? 1}
      />
    </div>
  )
}
