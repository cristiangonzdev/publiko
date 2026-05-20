import { createClient } from '@/lib/supabase/server'

export default async function AdminDashboardPage() {
  const supabase = await createClient()

  const [{ data: mrrData }, { data: clients }] = await Promise.all([
    supabase.rpc('get_mrr_total'),
    supabase.from('clients').select('id, status').eq('is_active', true),
  ])

  const activeCount = clients?.filter((c) => c.status === 'active').length ?? 0
  const leadCount = clients?.filter((c) => ['lead', 'proposal_sent', 'negotiation'].includes(c.status)).length ?? 0

  return (
    <div className="p-8">
      <h1 className="font-serif text-3xl text-ink-900">Panel admin</h1>
      <p className="mt-1 text-sm text-ink-500">Resumen del estado de la agencia</p>

      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'MRR Total', value: `${(mrrData as number ?? 0).toLocaleString('es-ES')} €` },
          { label: 'Clientes activos', value: activeCount },
          { label: 'En pipeline', value: leadCount },
          { label: 'Posts hoy', value: '—' },
        ].map((card) => (
          <div key={card.label} className="rounded-lg border border-ink-200 bg-white p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-400">{card.label}</p>
            <p className="mt-2 font-serif text-3xl text-ink-900">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">Accesos rápidos</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          {[
            { href: '/admin/clients/new', label: '+ Nuevo cliente' },
            { href: '/admin/ideas', label: 'Ver ideas pendientes' },
            { href: '/admin/review', label: 'Revisión de entregables' },
          ].map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-md border border-ink-200 bg-white px-4 py-2 text-sm text-ink-700 hover:bg-ink-50"
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
