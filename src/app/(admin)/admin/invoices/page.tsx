import { createClient } from '@/lib/supabase/server'
import { InvoiceManager } from '@/components/admin/InvoiceManager'
import { createSignedDownloadUrl } from '@/lib/upload/signed-download'
import type { InvoiceLine } from '@/types/supabase'

export default async function InvoicesPage() {
  const supabase = await createClient()

  const [{ data: invoices }, { data: clients }, { data: agency }] = await Promise.all([
    supabase
      .from('invoices')
      .select('id, client_id, invoice_number, amount, invoice_type, status, description, notes, period_start, period_end, due_date, paid_at, sent_at, pdf_url, lines, subtotal, tax_amount, irpf_amount, created_at')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('clients')
      .select('id, business_name, monthly_fee, billing_day, contact_email, billing_email, contact_phone, contact_whatsapp, fiscal_name, nif, fiscal_address, fiscal_city, fiscal_postal_code, fiscal_country')
      .eq('status', 'active')
      .eq('is_active', true),
    supabase
      .from('agency_settings')
      .select('agency_name, nif, address, city, postal_code, country, email, phone, logo_url, iban, payment_terms_days, igic_rate, irpf_rate')
      .limit(1)
      .maybeSingle(),
  ])

  const clientIds = [...new Set((invoices ?? []).map((i) => i.client_id))]
  const { data: invoiceClients } = await supabase
    .from('clients')
    .select('id, business_name')
    .in('id', clientIds.length > 0 ? clientIds : ['none'])

  const clientMap = Object.fromEntries((invoiceClients ?? []).map((c) => [c.id, c.business_name]))

  // Logo del PDF: https → directo; path de Storage → signed URL fresca.
  // Si no resuelve, el PDF sale sin imagen (fallback al nombre de la agencia).
  let logoSrc: string | null = null
  if (agency?.logo_url) {
    logoSrc = agency.logo_url.startsWith('https://')
      ? agency.logo_url
      : await createSignedDownloadUrl(agency.logo_url)
  }

  const totalPending = (invoices ?? [])
    .filter((i) => i.status === 'pending' || i.status === 'sent')
    .reduce((s, i) => s + i.amount, 0)

  const totalCollected = (invoices ?? [])
    .filter((i) => {
      const month = new Date().getMonth()
      const year = new Date().getFullYear()
      return i.status === 'paid' && new Date(i.paid_at ?? '').getMonth() === month && new Date(i.paid_at ?? '').getFullYear() === year
    })
    .reduce((s, i) => s + i.amount, 0)

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-widest text-brand">Facturación</div>
          <h1 className="mt-1 font-serif text-3xl text-ink-900">Facturas</h1>
        </div>
        <div className="flex gap-6 text-right">
          <div>
            <p className="text-xs text-ink-400">Por cobrar</p>
            <p className="font-serif text-2xl text-orange-600">{totalPending.toLocaleString('es-ES')} €</p>
          </div>
          <div>
            <p className="text-xs text-ink-400">Cobrado este mes</p>
            <p className="font-serif text-2xl text-green-600">{totalCollected.toLocaleString('es-ES')} €</p>
          </div>
        </div>
      </div>

      <InvoiceManager
        initialInvoices={(invoices ?? []).map((i) => ({
          ...i,
          business_name: clientMap[i.client_id] ?? i.client_id,
          lines: (i.lines ?? []) as unknown as InvoiceLine[],
        }))}
        activeClients={(clients ?? []).map((c) => ({
          id: c.id,
          business_name: c.business_name,
          monthly_fee: c.monthly_fee ?? 0,
          billing_day: c.billing_day ?? 1,
          contact_email: c.contact_email,
          billing_email: c.billing_email,
          contact_phone: c.contact_phone,
          contact_whatsapp: c.contact_whatsapp,
          fiscal_name: c.fiscal_name,
          nif: c.nif,
          fiscal_address: c.fiscal_address,
          fiscal_city: c.fiscal_city,
          fiscal_postal_code: c.fiscal_postal_code,
          fiscal_country: c.fiscal_country,
        }))}
        agency={agency ?? null}
        logoSrc={logoSrc}
      />
    </div>
  )
}
