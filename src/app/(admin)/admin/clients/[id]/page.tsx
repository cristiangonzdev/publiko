import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { BrollsManager } from '@/components/admin/BrollsManager'
import { GenerationConfigPanel } from '@/components/admin/GenerationConfigPanel'

interface Props {
  params: Promise<{ id: string }>
}

const statusLabel: Record<string, string> = {
  lead: 'Lead', proposal_sent: 'Propuesta', negotiation: 'Negociación',
  active: 'Activo', paused: 'Pausado', churned: 'Baja',
}
const statusColor: Record<string, string> = {
  lead: 'bg-ink-100 text-ink-600', proposal_sent: 'bg-blue-50 text-blue-700',
  negotiation: 'bg-yellow-50 text-yellow-700', active: 'bg-green-50 text-green-700',
  paused: 'bg-orange-50 text-orange-700', churned: 'bg-red-50 text-red-700',
}

export default async function ClientDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: client }, { data: brain }, { data: tasks }, { data: activities }, { data: invoices }] =
    await Promise.all([
      supabase.from('clients').select('*').eq('id', id).single(),
      supabase.from('brand_brains').select('onboarding_completed, onboarding_step').eq('client_id', id).single(),
      supabase
        .from('content_tasks')
        .select('id, title, status, deadline')
        .eq('client_id', id)
        .not('status', 'in', '("published","cancelled")')
        .order('deadline', { ascending: true })
        .limit(5),
      supabase
        .from('crm_activities')
        .select('id, activity_type, title, created_at, next_action, next_action_date')
        .eq('client_id', id)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('invoices')
        .select('id, invoice_number, amount, status, due_date, invoice_type')
        .eq('client_id', id)
        .order('created_at', { ascending: false })
        .limit(5),
    ])

  if (!client) notFound()

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/admin/clients" className="text-xs text-ink-400 hover:text-ink-700">← Clientes</Link>
          <h1 className="mt-2 font-serif text-3xl text-ink-900">{client.business_name}</h1>
          <div className="mt-2 flex items-center gap-3">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor[client.status] ?? 'bg-ink-100 text-ink-600'}`}>
              {statusLabel[client.status] ?? client.status}
            </span>
            <span className="text-sm text-ink-500">{client.monthly_fee ? `${client.monthly_fee} €/mes` : '—'}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/admin/clients/${id}/brand-brain`}
            className="rounded-md border border-ink-200 px-3 py-2 text-sm text-ink-700 hover:bg-ink-50"
          >
            Brand Brain {brain?.onboarding_completed ? '✓' : `(paso ${brain?.onboarding_step ?? 0}/6)`}
          </Link>
          <Link
            href={`/admin/clients/${id}/patterns`}
            className="rounded-md border border-ink-200 px-3 py-2 text-sm text-ink-700 hover:bg-ink-50"
          >
            ⭐ Patrones
          </Link>
          <Link
            href={`/admin/clients/${id}/ideas`}
            className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Ideas →
          </Link>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <section className="rounded-lg border border-ink-200 bg-white p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-400">Contacto</h2>
          <div className="mt-3 space-y-2 text-sm">
            <p className="font-medium text-ink-900">{client.contact_name}</p>
            {client.contact_email && <p className="text-ink-600">{client.contact_email}</p>}
            {client.contact_phone && <p className="text-ink-600">{client.contact_phone}</p>}
            {client.contact_whatsapp && (
              <a
                href={`https://wa.me/${client.contact_whatsapp.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-600 hover:underline"
              >
                WhatsApp →
              </a>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-ink-200 bg-white p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-400">Contrato</h2>
          <div className="mt-3 space-y-2 text-sm text-ink-700">
            <p>Setup: <span className="font-medium">{client.setup_fee ? `${client.setup_fee} €` : '—'}</span></p>
            <p>Cuota: <span className="font-medium">{client.monthly_fee ? `${client.monthly_fee} €/mes` : '—'}</span></p>
            <p>Día facturación: <span className="font-medium">{client.billing_day ?? '—'}</span></p>
            {client.contract_start && <p>Inicio: <span className="font-medium">{new Date(client.contract_start).toLocaleDateString('es-ES')}</span></p>}
            {client.contract_end && <p>Fin: <span className="font-medium text-orange-600">{new Date(client.contract_end).toLocaleDateString('es-ES')}</span></p>}
          </div>
        </section>

        <section className="rounded-lg border border-ink-200 bg-white p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-400">Seguidores actuales</h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {Object.entries((client.current_followers as Record<string, number>) ?? {}).map(([platform, count]) => (
              <div key={platform} className="rounded bg-ink-50 px-3 py-2">
                <p className="text-[10px] text-ink-400 capitalize">{platform}</p>
                <p className="font-medium text-ink-900">{count?.toLocaleString('es-ES') ?? '—'}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-ink-200 bg-white">
          <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-400">Tareas en producción</h2>
            <Link href={`/admin/clients/${id}/ideas`} className="text-xs text-brand hover:underline">Ver todas</Link>
          </div>
          <div className="divide-y divide-ink-50">
            {!tasks?.length && (
              <p className="px-5 py-4 text-sm text-ink-400">Sin tareas activas.</p>
            )}
            {tasks?.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-5 py-3">
                <p className="text-sm text-ink-800 truncate max-w-[200px]">{t.title}</p>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[11px] text-ink-400">{t.status}</span>
                  {t.deadline && (
                    <span className="text-[11px] text-ink-400">
                      {new Date(t.deadline).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-ink-200 bg-white">
          <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-400">Facturas recientes</h2>
          </div>
          <div className="divide-y divide-ink-50">
            {!invoices?.length && (
              <p className="px-5 py-4 text-sm text-ink-400">Sin facturas.</p>
            )}
            {invoices?.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-ink-800">{inv.invoice_number}</p>
                  <p className="text-[11px] text-ink-400">{inv.invoice_type}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-ink-900">{inv.amount} €</p>
                  <span className={`text-[10px] ${inv.status === 'paid' ? 'text-green-600' : inv.status === 'overdue' ? 'text-red-600' : 'text-ink-400'}`}>
                    {inv.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="lg:col-span-2">
          <GenerationConfigPanel
            clientId={id}
            initialConfig={(client.daily_generation_config as Record<string, unknown>) ?? {}}
          />
        </div>

        <div className="lg:col-span-2">
          <BrollsManager clientId={id} />
        </div>

        <section className="rounded-lg border border-ink-200 bg-white lg:col-span-2">
          <div className="border-b border-ink-100 px-5 py-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-400">Timeline CRM</h2>
          </div>
          <div className="divide-y divide-ink-50 max-h-72 overflow-y-auto">
            {!activities?.length && (
              <p className="px-5 py-4 text-sm text-ink-400">Sin actividad registrada.</p>
            )}
            {activities?.map((act) => (
              <div key={act.id} className="px-5 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-ink-800">{act.title}</p>
                    <p className="text-[11px] text-ink-400">{act.activity_type}</p>
                    {act.next_action && (
                      <p className="mt-1 text-xs text-ink-600">
                        Siguiente: {act.next_action}
                        {act.next_action_date && ` · ${new Date(act.next_action_date).toLocaleDateString('es-ES')}`}
                      </p>
                    )}
                  </div>
                  <span className="text-[11px] text-ink-400 flex-shrink-0">
                    {new Date(act.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
