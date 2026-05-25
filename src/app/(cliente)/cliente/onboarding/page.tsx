import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/getUser'
import { redirect } from 'next/navigation'
import { BrandBrainForm } from '@/components/brand-brain/BrandBrainForm'

export default async function ClienteOnboardingPage() {
  const { user } = await getAuthUser()
  const supabase = await createClient()

  const { data: client } = await supabase
    .from('clients')
    .select('id, business_name')
    .eq('client_user_id', user.id)
    .single()

  if (!client) redirect('/cliente')

  const { data: brain } = await supabase
    .from('brand_brains')
    .select('*')
    .eq('client_id', client.id)
    .single()

  if (brain?.onboarding_completed) redirect('/cliente')

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl">
      <div>
        <div className="text-xs font-medium uppercase tracking-widest text-brand">Onboarding</div>
        <h1 className="mt-1 font-serif text-2xl sm:text-3xl text-ink-900">Cuéntanos sobre {client.business_name}</h1>
        <p className="mt-2 text-sm text-ink-500">
          Completa esta ficha para que podamos crear contenido que suene exactamente como tu negocio.
          Se guarda automáticamente.
        </p>
      </div>

      <div className="mt-8">
        <BrandBrainForm
          clientId={client.id}
          initialData={brain ?? {}}
          currentStep={brain?.onboarding_step ?? 1}
          isCompleted={false}
        />
      </div>
    </div>
  )
}
