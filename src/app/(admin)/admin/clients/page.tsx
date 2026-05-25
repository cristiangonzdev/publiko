import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

const statusLabel: Record<string, string> = {
  lead: 'Lead',
  proposal_sent: 'Propuesta',
  negotiation: 'Negociación',
  active: 'Activo',
  paused: 'Pausado',
  churned: 'Baja',
}

const statusColor: Record<string, string> = {
  lead: 'bg-ink-100 text-ink-600',
  proposal_sent: 'bg-blue-50 text-blue-700',
  negotiation: 'bg-yellow-50 text-yellow-700',
  active: 'bg-green-50 text-green-700',
  paused: 'bg-orange-50 text-orange-700',
  churned: 'bg-red-50 text-red-700',
}

export default async function ClientsPage() {
  const supabase = await createClient()
  const { data: clients } = await supabase
    .from('clients')
    .select('id, business_name, slug, status, monthly_fee, contact_name, contact_phone')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  const clientList = clients ?? []

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-2xl sm:text-3xl text-ink-900">Clientes</h1>
        <Link
          href="/admin/clients/new"
          className="rounded-md bg-ink-900 px-4 py-2 text-sm font-medium text-white hover:bg-ink-800"
        >
          + Nuevo cliente
        </Link>
      </div>

      {/* Mobile: cards */}
      <div className="mt-6 space-y-3 md:hidden">
        {!clientList.length && (
          <p className="rounded-lg border border-dashed border-ink-200 py-8 text-center text-sm text-ink-400">
            Sin clientes aún. <Link href="/admin/clients/new" className="text-brand underline">Añade el primero.</Link>
          </p>
        )}
        {clientList.map((c) => (
          <Link
            key={c.id}
            href={`/admin/clients/${c.id}`}
            className="block rounded-lg border border-ink-200 bg-white p-4 active:bg-ink-50"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 flex-1 break-words font-medium text-ink-900">{c.business_name}</p>
              <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${statusColor[c.status] ?? 'bg-ink-100 text-ink-600'}`}>
                {statusLabel[c.status] ?? c.status}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-ink-500">
              <span className="truncate">{c.contact_name ?? '—'}</span>
              <span className="flex-shrink-0">{c.monthly_fee ? `${c.monthly_fee} €/mes` : '—'}</span>
            </div>
          </Link>
        ))}
      </div>

      {/* Desktop: table */}
      <div className="mt-8 hidden md:block overflow-x-auto rounded-lg border border-ink-200 bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-ink-200 bg-ink-50">
            <tr>
              {['Negocio', 'Estado', 'Cuota/mes', 'Contacto', 'Acciones'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {!clientList.length && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-ink-400">
                  Sin clientes aún. <Link href="/admin/clients/new" className="text-brand underline">Añade el primero.</Link>
                </td>
              </tr>
            )}
            {clientList.map((c) => (
              <tr key={c.id} className="hover:bg-ink-50">
                <td className="px-4 py-3 font-medium text-ink-900">{c.business_name}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor[c.status] ?? 'bg-ink-100 text-ink-600'}`}>
                    {statusLabel[c.status] ?? c.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-ink-700">{c.monthly_fee ? `${c.monthly_fee} €` : '—'}</td>
                <td className="px-4 py-3 text-ink-600">{c.contact_name}</td>
                <td className="px-4 py-3">
                  <Link href={`/admin/clients/${c.id}`} className="text-brand hover:underline">Ver</Link>
                  <span className="mx-2 text-ink-300">·</span>
                  <Link href={`/admin/clients/${c.id}/brand-brain`} className="text-ink-500 hover:text-ink-800 hover:underline">Brand Brain</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
