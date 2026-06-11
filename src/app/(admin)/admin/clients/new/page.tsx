import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { getAuthContext } from '@/lib/auth/guards'

async function createClient(formData: FormData) {
  'use server'
  const ctx = await getAuthContext()
  if (!ctx || ctx.role !== 'admin') throw new Error('No autorizado')
  const supabase = await createServiceClient()

  const businessName = formData.get('business_name') as string
  const slug = businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  const contactName = formData.get('contact_name') as string
  const contactEmail = formData.get('contact_email') as string
  const contactPhone = formData.get('contact_phone') as string
  const monthlyFee = parseInt(formData.get('monthly_fee') as string) || 0
  const optional = (key: string) => ((formData.get(key) as string | null)?.trim() || null)

  const { data, error } = await supabase
    .from('clients')
    .insert({
      business_name: businessName,
      slug,
      contact_name: contactName,
      contact_email: contactEmail,
      contact_phone: contactPhone,
      monthly_fee: monthlyFee,
      fiscal_name: optional('fiscal_name'),
      nif: optional('nif'),
      billing_email: optional('billing_email'),
      status: 'lead',
    })
    .select('id')
    .single()

  if (error || !data) {
    redirect('/admin/clients/new?error=true')
  }

  // Crear brand brain vacío automáticamente
  await supabase.from('brand_brains').insert({ client_id: data.id })

  redirect(`/admin/clients/${data.id}/brand-brain`)
}

interface Props {
  searchParams: Promise<{ error?: string }>
}

export default async function NewClientPage({ searchParams }: Props) {
  const { error } = await searchParams

  return (
    <div className="mx-auto max-w-xl p-8">
      <h1 className="font-serif text-3xl text-ink-900">Nuevo cliente</h1>
      <p className="mt-1 text-sm text-ink-500">Al crear el cliente se abrirá directamente el Brand Brain.</p>

      {error && (
        <div className="mt-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Error al crear el cliente. Comprueba que el nombre no esté duplicado.
        </div>
      )}

      <form action={createClient} className="mt-8 space-y-5">
        {[
          { name: 'business_name', label: 'Nombre del negocio *', type: 'text', required: true },
          { name: 'contact_name', label: 'Nombre del contacto *', type: 'text', required: true },
          { name: 'contact_email', label: 'Email de contacto', type: 'email', required: false },
          { name: 'contact_phone', label: 'Teléfono', type: 'tel', required: false },
          { name: 'monthly_fee', label: 'Cuota mensual (€)', type: 'number', required: false },
          { name: 'fiscal_name', label: 'Razón social (para facturas)', type: 'text', required: false },
          { name: 'nif', label: 'NIF (para facturas)', type: 'text', required: false },
          { name: 'billing_email', label: 'Email de facturación', type: 'email', required: false },
        ].map((field) => (
          <div key={field.name}>
            <label className="block text-sm font-medium text-ink-700">{field.label}</label>
            <input
              type={field.type}
              name={field.name}
              required={field.required}
              className="mt-1 w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>
        ))}

        <button
          type="submit"
          className="w-full rounded-md bg-ink-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-ink-800"
        >
          Crear cliente y abrir Brand Brain →
        </button>
      </form>
    </div>
  )
}
