import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getAuthContext } from '@/lib/auth/guards'
import { createSignedDownloadUrl } from '@/lib/upload/signed-download'

async function saveAgencySettings(formData: FormData) {
  'use server'
  const ctx = await getAuthContext()
  if (!ctx || ctx.role !== 'admin' || !ctx.organizationId) throw new Error('No autorizado')
  const supabase = await createServiceClient()

  const text = (name: string) => {
    const v = (formData.get(name) as string | null)?.trim()
    return v || null
  }
  const num = (name: string, fallback: number) => {
    const v = parseFloat(formData.get(name) as string)
    return Number.isFinite(v) ? v : fallback
  }

  const agencyName = text('agency_name')
  const nif = text('nif')
  if (!agencyName || !nif) redirect('/admin/settings/agency?error=required')

  const logoUrl = text('logo_url')
  // URL pública (https) o path de Storage; cualquier otra cosa se rechaza.
  if (logoUrl && !/^https:\/\//.test(logoUrl) && !/^[\w\-./]+$/.test(logoUrl)) {
    redirect('/admin/settings/agency?error=logo')
  }

  const values = {
    agency_name: agencyName,
    nif,
    address: text('address'),
    city: text('city'),
    postal_code: text('postal_code'),
    country: text('country') ?? 'ES',
    email: text('email'),
    phone: text('phone'),
    logo_url: logoUrl,
    iban: text('iban'),
    payment_terms_days: Math.round(num('payment_terms_days', 30)),
    invoice_prefix: text('invoice_prefix') ?? 'INV',
    igic_rate: num('igic_rate', 7.0),
    irpf_rate: num('irpf_rate', 15.0),
  }

  // Una fila por organización (service client bypasea RLS: filtrar por org).
  const { data: existing } = await supabase
    .from('agency_settings')
    .select('id')
    .eq('organization_id', ctx.organizationId)
    .maybeSingle()

  const { error } = existing
    ? await supabase.from('agency_settings').update(values).eq('id', existing.id)
    : await supabase.from('agency_settings').insert({ ...values, organization_id: ctx.organizationId })

  if (error) redirect('/admin/settings/agency?error=save')
  redirect('/admin/settings/agency?saved=true')
}

interface Props {
  searchParams: Promise<{ error?: string; saved?: string }>
}

const inputClass =
  'mt-1 w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand'

const errorMessages: Record<string, string> = {
  required: 'El nombre de la agencia y el NIF son obligatorios.',
  logo: 'El logo debe ser una URL https o un path de Storage válido.',
  save: 'Error al guardar la configuración. Inténtalo de nuevo.',
}

export default async function AgencySettingsPage({ searchParams }: Props) {
  const { error, saved } = await searchParams
  // createClient (anon + RLS): tras 0019 las policies devuelven solo la fila de la org.
  const supabase = await createClient()
  const { data: settings } = await supabase.from('agency_settings').select('*').limit(1).maybeSingle()

  // Logo: si es URL https se usa tal cual; si es path de Storage se firma para el preview.
  let logoPreview: string | null = null
  if (settings?.logo_url) {
    logoPreview = settings.logo_url.startsWith('https://')
      ? settings.logo_url
      : await createSignedDownloadUrl(settings.logo_url)
  }

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="font-serif text-3xl text-ink-900">Datos de la agencia</h1>
      <p className="mt-1 text-sm text-ink-500">
        Estos datos aparecen en la cabecera de todas las facturas. Sin ellos no se pueden crear facturas.
      </p>

      {error && (
        <div className="mt-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessages[error] ?? errorMessages.save}
        </div>
      )}
      {saved && (
        <div className="mt-4 rounded border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          Configuración guardada.
        </div>
      )}

      <form action={saveAgencySettings} className="mt-8 space-y-8">
        <section className="rounded-xl border border-ink-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-ink-900">Identidad fiscal</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-ink-700">Nombre de la agencia *</label>
              <input name="agency_name" required defaultValue={settings?.agency_name ?? ''} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-700">NIF *</label>
              <input name="nif" required defaultValue={settings?.nif ?? ''} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-700">País</label>
              <input name="country" defaultValue={settings?.country ?? 'ES'} className={inputClass} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-ink-700">Dirección</label>
              <input name="address" defaultValue={settings?.address ?? ''} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-700">Ciudad</label>
              <input name="city" defaultValue={settings?.city ?? ''} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-700">Código postal</label>
              <input name="postal_code" defaultValue={settings?.postal_code ?? ''} className={inputClass} />
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-ink-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-ink-900">Contacto y marca</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-ink-700">Email</label>
              <input name="email" type="email" defaultValue={settings?.email ?? ''} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-700">Teléfono</label>
              <input name="phone" type="tel" defaultValue={settings?.phone ?? ''} className={inputClass} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-ink-700">Logo (URL https o path de Storage)</label>
              <input name="logo_url" defaultValue={settings?.logo_url ?? ''} className={inputClass} placeholder="https://midominio.com/logo.png" />
              <p className="mt-1 text-xs text-ink-400">
                Debe ser accesible desde el navegador para que aparezca en el PDF. Si no carga en el preview de abajo, no saldrá en la factura.
              </p>
              {logoPreview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoPreview} alt="Preview del logo" className="mt-3 h-16 w-auto rounded border border-ink-100 object-contain" />
              )}
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-ink-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-ink-900">Facturación</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-ink-700">IBAN</label>
              <input name="iban" defaultValue={settings?.iban ?? ''} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-700">Prefijo de factura</label>
              <input name="invoice_prefix" defaultValue={settings?.invoice_prefix ?? 'INV'} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-700">Plazo de pago (días)</label>
              <input name="payment_terms_days" type="number" min="0" defaultValue={settings?.payment_terms_days ?? 30} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-700">IGIC (%)</label>
              <input name="igic_rate" type="number" step="0.01" min="0" defaultValue={settings?.igic_rate ?? 7} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-700">IRPF (%)</label>
              <input name="irpf_rate" type="number" step="0.01" min="0" defaultValue={settings?.irpf_rate ?? 15} className={inputClass} />
            </div>
            {settings && (
              <div className="sm:col-span-2 text-xs text-ink-400">
                Próximo número de factura: {settings.invoice_prefix}-{new Date().getFullYear()}-{String(settings.next_invoice_number).padStart(4, '0')}
              </div>
            )}
          </div>
        </section>

        <button
          type="submit"
          className="w-full rounded-md bg-ink-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-ink-800"
        >
          Guardar configuración
        </button>
      </form>
    </div>
  )
}
