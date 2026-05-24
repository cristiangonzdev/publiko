import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient, createServiceClient } from '@/lib/supabase/server'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}

export default async function EditClientPage({ params, searchParams }: Props) {
  const { id } = await params
  const { error } = await searchParams
  const supabase = await createClient()

  const [{ data: client }, { data: editors }, { data: grabadors }] = await Promise.all([
    supabase.from('clients').select('*').eq('id', id).is('deleted_at', null).single(),
    supabase.from('profiles').select('id, full_name').eq('role', 'editor').eq('is_active', true).order('full_name'),
    supabase.from('profiles').select('id, full_name').eq('role', 'grabador').eq('is_active', true).order('full_name'),
  ])

  if (!client) notFound()

  // Campos de integraciones que pueden no estar en los tipos generados aún
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clientAny = client as any

  async function updateClient(formData: FormData) {
    'use server'
    const svc = await createServiceClient()

    const getValue = (key: string) => (formData.get(key) as string | null) || null

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (svc.from('clients') as any)
      .update({
        business_name: (formData.get('business_name') as string).trim(),
        contact_name: (formData.get('contact_name') as string).trim(),
        contact_email: getValue('contact_email'),
        contact_phone: getValue('contact_phone'),
        contact_whatsapp: getValue('contact_whatsapp'),
        monthly_fee: parseInt(formData.get('monthly_fee') as string) || 0,
        setup_fee: parseInt(formData.get('setup_fee') as string) || 0,
        billing_day: parseInt(formData.get('billing_day') as string) || 1,
        payment_method: getValue('payment_method'),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        status: (formData.get('status') as any) || client!.status,
        contract_start: getValue('contract_start'),
        contract_end: getValue('contract_end'),
        assigned_editor_id: getValue('assigned_editor_id'),
        assigned_grabador_id: getValue('assigned_grabador_id'),
        meta_business_id: getValue('meta_business_id'),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        facebook_page_id: getValue('facebook_page_id'),
        // Solo actualizar token si se ha escrito uno nuevo (no vacío)
        ...(getValue('meta_system_user_token')
          ? { meta_system_user_token: getValue('meta_system_user_token') }
          : {}),
        gmb_account_id: getValue('gmb_account_id'),
        gmb_location_id: getValue('gmb_location_id'),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) redirect(`/admin/clients/${id}/edit?error=true`)
    redirect(`/admin/clients/${id}`)
  }

  const statuses = [
    { value: 'lead', label: 'Lead' },
    { value: 'proposal_sent', label: 'Propuesta enviada' },
    { value: 'negotiation', label: 'Negociación' },
    { value: 'active', label: 'Activo' },
    { value: 'paused', label: 'Pausado' },
    { value: 'churned', label: 'Baja' },
  ]

  const inputClass = 'mt-1 w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand'

  return (
    <div className="mx-auto max-w-2xl p-8">
      <Link href={`/admin/clients/${id}`} className="text-xs text-ink-400 hover:text-ink-700">← {client.business_name}</Link>
      <h1 className="mt-2 font-serif text-3xl text-ink-900">Editar cliente</h1>

      {error && (
        <div className="mt-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Error al guardar los cambios. Comprueba que el nombre no esté duplicado.
        </div>
      )}

      <form action={updateClient} className="mt-8 space-y-8">
        {/* Datos del negocio */}
        <section>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-ink-400">Negocio</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink-700">Nombre del negocio *</label>
              <input type="text" name="business_name" required defaultValue={client.business_name} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-700">Estado</label>
              <select name="status" defaultValue={client.status} className={inputClass}>
                {statuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>
        </section>

        {/* Contacto */}
        <section>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-ink-400">Contacto</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-ink-700">Nombre del contacto *</label>
              <input type="text" name="contact_name" required defaultValue={client.contact_name} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-700">Email</label>
              <input type="email" name="contact_email" defaultValue={client.contact_email ?? ''} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-700">Teléfono</label>
              <input type="tel" name="contact_phone" defaultValue={client.contact_phone ?? ''} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-700">WhatsApp</label>
              <input type="tel" name="contact_whatsapp" defaultValue={client.contact_whatsapp ?? ''} className={inputClass} />
            </div>
          </div>
        </section>

        {/* Contrato */}
        <section>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-ink-400">Contrato y facturación</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-ink-700">Cuota mensual (€)</label>
              <input type="number" name="monthly_fee" defaultValue={client.monthly_fee} min="0" className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-700">Setup fee (€)</label>
              <input type="number" name="setup_fee" defaultValue={client.setup_fee} min="0" className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-700">Día de facturación</label>
              <input type="number" name="billing_day" defaultValue={client.billing_day ?? 1} min="1" max="31" className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-700">Método de pago</label>
              <input type="text" name="payment_method" defaultValue={client.payment_method ?? ''} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-700">Inicio contrato</label>
              <input type="date" name="contract_start" defaultValue={client.contract_start ?? ''} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-700">Fin contrato</label>
              <input type="date" name="contract_end" defaultValue={client.contract_end ?? ''} className={inputClass} />
            </div>
          </div>
        </section>

        {/* Equipo asignado */}
        <section>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-ink-400">Equipo por defecto</h2>
          <p className="mb-4 text-xs text-ink-400">Se pre-rellena al enviar ideas a producción.</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-ink-700">Editor</label>
              <select name="assigned_editor_id" defaultValue={client.assigned_editor_id ?? ''} className={inputClass}>
                <option value="">— Sin asignar —</option>
                {editors?.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-700">Grabador</label>
              <select name="assigned_grabador_id" defaultValue={client.assigned_grabador_id ?? ''} className={inputClass}>
                <option value="">— Sin asignar —</option>
                {grabadors?.map(g => <option key={g.id} value={g.id}>{g.full_name}</option>)}
              </select>
            </div>
          </div>
        </section>

        {/* Redes sociales e integraciones */}
        <section>
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-400">Redes sociales e integraciones</h2>
          <p className="mb-4 text-xs text-ink-400">
            Necesario para que la publicación automática funcione. El token nunca se muestra una vez guardado.
          </p>
          <div className="space-y-4">
            <div className="rounded-lg border border-ink-200 bg-ink-50 p-4 space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-500">Meta (Instagram / Facebook)</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-ink-700">
                    Instagram Business Account ID
                  </label>
                  <p className="mb-1 text-[11px] text-ink-400">El número de 15-17 dígitos de la cuenta IG Business</p>
                  <input
                    type="text"
                    name="meta_business_id"
                    defaultValue={clientAny.meta_business_id ?? ''}
                    placeholder="ej: 17841400000000000"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-700">
                    Facebook Page ID
                  </label>
                  <p className="mb-1 text-[11px] text-ink-400">ID de la página de Facebook vinculada</p>
                  <input
                    type="text"
                    name="facebook_page_id"
                    defaultValue={clientAny.facebook_page_id ?? ''}
                    placeholder="ej: 123456789012345"
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-700">
                  Meta System User Token
                </label>
                <p className="mb-1 text-[11px] text-ink-400">
                  {clientAny.meta_system_user_token
                    ? '✓ Token guardado — deja en blanco para mantener el actual'
                    : 'Aún no configurado'}
                </p>
                <input
                  type="password"
                  name="meta_system_user_token"
                  placeholder={clientAny.meta_system_user_token ? '••••••••••••••••' : 'Pegar token aquí'}
                  className={inputClass}
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="rounded-lg border border-ink-200 bg-ink-50 p-4 space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-500">Google My Business</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-ink-700">GMB Account ID</label>
                  <p className="mb-1 text-[11px] text-ink-400">Formato: accounts/XXXXXXXXXX</p>
                  <input
                    type="text"
                    name="gmb_account_id"
                    defaultValue={clientAny.gmb_account_id ?? ''}
                    placeholder="accounts/123456789"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-700">GMB Location ID</label>
                  <p className="mb-1 text-[11px] text-ink-400">Formato: locations/XXXXXXXXXX</p>
                  <input
                    type="text"
                    name="gmb_location_id"
                    defaultValue={clientAny.gmb_location_id ?? ''}
                    placeholder="locations/987654321"
                    className={inputClass}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="flex gap-3">
          <button
            type="submit"
            className="rounded-md bg-ink-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-ink-800"
          >
            Guardar cambios
          </button>
          <Link
            href={`/admin/clients/${id}`}
            className="rounded-md border border-ink-200 px-5 py-2.5 text-sm text-ink-700 hover:bg-ink-50"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  )
}
