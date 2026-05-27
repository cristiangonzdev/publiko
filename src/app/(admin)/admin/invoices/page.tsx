import { createClient } from '@/lib/supabase/server'
import { InvoiceManager } from '@/components/admin/InvoiceManager'

export default async function InvoicesPage() {
  const supabase = await createClient()

  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, client_id, invoice_number, amount, invoice_type, status, due_date, paid_at, created_at')
    .order('created_at', { ascending: false })
    .limit(100)

  const { data: clients } = await supabase
    .from('clients')
    .select('id, business_name, monthly_fee, billing_day, contact_email')
    .eq('status', 'active')
    .eq('is_active', true)

  const clientIds = [...new Set((invoices ?? []).map((i) => i.client_id))]
  const { data: invoiceClients } = await supabase
    .from('clients')
    .select('id, business_name')
    .in('id', clientIds.length > 0 ? clientIds : ['none'])

  const clientMap = Object.fromEntries((invoiceClients ?? []).map((c) => [c.id, c.business_name]))

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
        initialInvoices={(invoices ?? []).map((i) => ({ ...i, business_name: clientMap[i.client_id] ?? i.client_id }))}
        activeClients={(clients ?? []).map((c) => ({
          id: c.id,
          business_name: c.business_name,
          monthly_fee: c.monthly_fee ?? 0,
          billing_day: c.billing_day ?? 1,
          contact_email: c.contact_email,
        }))}
      />
    </div>
  )
}
