import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/getUser'

export default async function ClienteFacturasPage() {
  const { user } = await getAuthUser()
  const supabase = await createClient()

  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('client_user_id', user.id)
    .single()

  const { data: invoices } = client
    ? await supabase
        .from('invoices')
        .select('id, invoice_number, amount, invoice_type, status, due_date, paid_at, pdf_url')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false })
    : { data: [] }

  const statusLabel: Record<string, string> = {
    pending: 'Pendiente',
    sent: 'Enviada',
    paid: 'Pagada',
    overdue: 'Vencida',
  }
  const statusColor: Record<string, string> = {
    pending: 'text-ink-500',
    sent: 'text-blue-600',
    paid: 'text-green-600',
    overdue: 'text-red-600 font-semibold',
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div>
        <div className="text-xs font-medium uppercase tracking-widest text-brand">Portal</div>
        <h1 className="mt-1 font-serif text-2xl sm:text-3xl text-ink-900">Facturas</h1>
      </div>

      {/* Mobile: cards */}
      <div className="mt-6 space-y-3 md:hidden">
        {!invoices?.length && (
          <p className="rounded-lg border border-dashed border-ink-200 py-8 text-center text-sm text-ink-400">
            Sin facturas aún.
          </p>
        )}
        {invoices?.map((inv) => (
          <div key={inv.id} className="rounded-lg border border-ink-200 bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink-900">{inv.invoice_number}</p>
                <p className="mt-0.5 text-xs text-ink-500 capitalize">{inv.invoice_type}</p>
              </div>
              <p className="text-lg font-medium text-ink-900">{inv.amount} €</p>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className={statusColor[inv.status] ?? 'text-ink-500'}>
                {statusLabel[inv.status] ?? inv.status}
              </span>
              <span className="text-ink-500">
                Vence: {inv.due_date ? new Date(inv.due_date).toLocaleDateString('es-ES') : '—'}
              </span>
            </div>
            {inv.pdf_url && (
              <a
                href={inv.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 block rounded-md border border-ink-200 py-2 text-center text-xs text-brand hover:bg-ink-50"
              >
                Descargar PDF →
              </a>
            )}
          </div>
        ))}
      </div>

      {/* Desktop: table */}
      <div className="mt-6 hidden md:block overflow-x-auto rounded-lg border border-ink-200 bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-ink-200 bg-ink-50">
            <tr>
              {['Número', 'Tipo', 'Importe', 'Vencimiento', 'Estado', ''].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {!invoices?.length && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-ink-400">
                  Sin facturas aún.
                </td>
              </tr>
            )}
            {invoices?.map((inv) => (
              <tr key={inv.id} className="hover:bg-ink-50">
                <td className="px-4 py-3 font-medium text-ink-900">{inv.invoice_number}</td>
                <td className="px-4 py-3 text-ink-600 capitalize">{inv.invoice_type}</td>
                <td className="px-4 py-3 font-medium text-ink-900">{inv.amount} €</td>
                <td className="px-4 py-3 text-ink-600">
                  {inv.due_date ? new Date(inv.due_date).toLocaleDateString('es-ES') : '—'}
                </td>
                <td className={`px-4 py-3 ${statusColor[inv.status] ?? 'text-ink-500'}`}>
                  {statusLabel[inv.status] ?? inv.status}
                </td>
                <td className="px-4 py-3">
                  {inv.pdf_url && (
                    <a href={inv.pdf_url} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline text-xs">
                      PDF →
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
