import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="font-serif text-3xl text-ink-900">Dashboard</h1>
      <p className="mt-2 text-sm text-ink-600">
        Bienvenido{user?.email ? `, ${user.email}` : ''}. Cada rol verá aquí su panel personalizado.
      </p>

      <section className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'MRR Total', value: '—' },
          { label: 'Clientes activos', value: '—' },
          { label: 'Posts esta semana', value: '—' },
          { label: 'Pendientes de revisar', value: '—' },
        ].map((card) => (
          <div key={card.label} className="rounded-lg border border-ink-200 bg-white p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-500">{card.label}</p>
            <p className="mt-2 font-serif text-3xl text-ink-900">{card.value}</p>
          </div>
        ))}
      </section>

      <p className="mt-12 text-xs text-ink-400">
        Próximo paso: conectar con Supabase y montar las RPCs (`get_mrr_total`, `get_posts_to_publish`).
      </p>
    </main>
  )
}
