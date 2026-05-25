'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

interface Invoice {
  id: string
  client_id: string
  business_name: string
  invoice_number: string
  amount: number
  invoice_type: string
  status: string
  due_date: string | null
  paid_at: string | null
  created_at: string
}

interface ActiveClient {
  id: string
  business_name: string
  monthly_fee: number
  billing_day: number
  contact_email: string | null
}

interface Props {
  initialInvoices: Invoice[]
  activeClients: ActiveClient[]
}

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-ink-100 text-ink-600',
  sent: 'bg-blue-50 text-blue-700',
  paid: 'bg-green-50 text-green-700',
  overdue: 'bg-red-50 text-red-700',
}

export function InvoiceManager({ initialInvoices, activeClients }: Props) {
  const [invoices, setInvoices] = useState(initialInvoices)
  const [showGenerate, setShowGenerate] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)

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

  const grouped = invoices.reduce<Record<string, Invoice[]>>((acc, inv) => {
    const key = inv.status
    acc[key] = [...(acc[key] ?? []), inv]
    return acc
  }, {})

  return (
    <div className="mt-6">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={generateMonthly}
          disabled={generating}
          className="rounded-md bg-ink-900 px-4 py-2 text-sm font-medium text-white hover:bg-ink-800 disabled:opacity-50"
        >
          {generating ? 'Generando…' : '⚡ Generar facturas del mes'}
        </button>
        <span className="text-xs text-ink-400">Genera una factura por cada cliente activo</span>
      </div>

      {['overdue', 'pending', 'sent', 'paid'].map((status) => {
        const group = grouped[status] ?? []
        if (!group.length) return null
        return (
          <div key={status} className="mb-8">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-700">
              <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', STATUS_COLOR[status])}>
                {status === 'overdue' ? 'Vencidas' : status === 'pending' ? 'Pendientes' : status === 'sent' ? 'Enviadas' : 'Pagadas'}
              </span>
              <span className="text-ink-400 font-normal">{group.length}</span>
              <span className="ml-auto text-ink-400 font-normal">
                {group.reduce((s, i) => s + i.amount, 0).toLocaleString('es-ES')} €
              </span>
            </h2>
            <div className="overflow-x-auto rounded-lg border border-ink-200 bg-white">
              <table className="w-full min-w-[640px] text-sm">
                <tbody className="divide-y divide-ink-100">
                  {group.map((inv) => (
                    <tr key={inv.id} className="hover:bg-ink-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-ink-900">{inv.business_name}</p>
                        <p className="text-xs text-ink-400">{inv.invoice_number} · {inv.invoice_type}</p>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-ink-900">
                        {inv.amount.toLocaleString('es-ES')} €
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-ink-500">
                        {inv.due_date ? new Date(inv.due_date).toLocaleDateString('es-ES') : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
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
    </div>
  )
}
