'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { invoiceStatusStyle } from '@/lib/status'
import type { AgencyInfo, BillableClient, InvoiceRow } from '@/components/invoices/types'
import { InvoiceForm } from '@/components/invoices/InvoiceForm'
import { InvoiceDetail } from '@/components/invoices/InvoiceDetail'

interface Props {
  initialInvoices: InvoiceRow[]
  activeClients: BillableClient[]
  agency: AgencyInfo | null
  logoSrc: string | null
}

// Títulos de grupo en plural (distintos de la etiqueta singular por factura).
const GROUP_LABEL: Record<string, string> = {
  overdue: 'Vencidas',
  pending: 'Pendientes',
  sent: 'Enviadas',
  paid: 'Pagadas',
  draft: 'Borradores',
  cancelled: 'Anuladas',
}

export function InvoiceManager({ initialInvoices, activeClients, agency, logoSrc }: Props) {
  const router = useRouter()
  const [invoices, setInvoices] = useState(initialInvoices)
  const [generating, setGenerating] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const generateMonthly = async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/invoices/generate-monthly', { method: 'POST' })
      if (!res.ok) throw new Error(await res.text())
      const { created } = await res.json() as { created: number }
      alert(`${created} facturas generadas`)
      window.location.reload()
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setGenerating(false)
    }
  }

  const markPaid = async (invoiceId: string) => {
    setLoading(invoiceId)
    try {
      await fetch(`/api/invoices/${invoiceId}/paid`, { method: 'POST' })
      setInvoices((prev) => prev.map((i) =>
        i.id === invoiceId ? { ...i, status: 'paid', paid_at: new Date().toISOString() } : i
      ))
    } finally {
      setLoading(null)
    }
  }

  const openNewInvoice = () => {
    // Sin datos de agencia no se puede facturar: la cabecera del PDF los necesita.
    if (!agency) {
      toast.error('Configura primero los datos de la agencia para poder facturar')
      router.push('/admin/settings/agency')
      return
    }
    setShowForm(true)
  }

  const applyPatch = (patch: Partial<InvoiceRow> & { id: string }) =>
    setInvoices((prev) => prev.map((i) => (i.id === patch.id ? { ...i, ...patch } : i)))

  const grouped = invoices.reduce<Record<string, InvoiceRow[]>>((acc, inv) => {
    const key = inv.status
    acc[key] = [...(acc[key] ?? []), inv]
    return acc
  }, {})

  const selected = invoices.find((i) => i.id === selectedId) ?? null

  return (
    <div className="mt-6">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <button
          onClick={openNewInvoice}
          className="rounded-md bg-ink-900 px-4 py-2 text-sm font-medium text-white hover:bg-ink-800"
        >
          + Nueva factura
        </button>
        <button
          onClick={generateMonthly}
          disabled={generating}
          className="rounded-md border border-ink-300 bg-white px-4 py-2 text-sm font-medium text-ink-900 hover:bg-ink-50 disabled:opacity-50"
        >
          {generating ? 'Generando…' : '⚡ Generar facturas del mes'}
        </button>
        <span className="text-xs text-ink-400">El botón ⚡ genera una factura por cada cliente activo</span>
      </div>

      {['overdue', 'pending', 'sent', 'paid', 'draft', 'cancelled'].map((status) => {
        const group = grouped[status] ?? []
        if (!group.length) return null
        return (
          <div key={status} className="mb-8">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-700">
              <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', invoiceStatusStyle(status).badge)}>
                {GROUP_LABEL[status] ?? invoiceStatusStyle(status).label}
              </span>
              <span className="text-ink-400 font-normal">{group.length}</span>
              <span className="ml-auto text-ink-400 font-normal">
                {group.reduce((s, i) => s + i.amount, 0).toLocaleString('es-ES')} €
              </span>
            </h2>
            <div className="overflow-hidden rounded-lg border border-ink-200 bg-white">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-ink-100">
                  {group.map((inv) => (
                    <tr
                      key={inv.id}
                      className="cursor-pointer hover:bg-ink-50"
                      onClick={() => setSelectedId(inv.id)}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-ink-900">{inv.business_name}</p>
                        <p className="text-xs text-ink-400">
                          {inv.invoice_number} · {inv.invoice_type}
                          {inv.pdf_url && <span title="PDF generado"> · 📄</span>}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-ink-900">
                        {inv.amount.toLocaleString('es-ES')} €
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-ink-500">
                        {inv.due_date ? new Date(inv.due_date).toLocaleDateString('es-ES') : '—'}
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        {(status === 'pending' || status === 'sent' || status === 'overdue') && (
                          <button
                            onClick={() => markPaid(inv.id)}
                            disabled={loading === inv.id}
                            className="rounded bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
                          >
                            {loading === inv.id ? '…' : 'Marcar pagada'}
                          </button>
                        )}
                        {status === 'paid' && inv.paid_at && (
                          <span className="text-xs text-ink-400">
                            {new Date(inv.paid_at).toLocaleDateString('es-ES')}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}

      {showForm && agency && (
        <InvoiceForm
          clients={activeClients}
          agency={agency}
          logoSrc={logoSrc}
          onClose={() => setShowForm(false)}
          onCreated={(invoice) => setInvoices((prev) => [invoice, ...prev])}
        />
      )}

      {selected && (
        <InvoiceDetail
          invoice={selected}
          client={activeClients.find((c) => c.id === selected.client_id) ?? null}
          agency={agency}
          logoSrc={logoSrc}
          onClose={() => setSelectedId(null)}
          onUpdated={applyPatch}
        />
      )}
    </div>
  )
}
