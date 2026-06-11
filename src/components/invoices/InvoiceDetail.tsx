'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { invoiceStatusStyle } from '@/lib/status'
import type { InvoiceLine } from '@/types/supabase'
import type { AgencyInfo, BillableClient, InvoiceRow } from './types'
import { generateAndUploadPdf } from './generatePdf'

interface Props {
  invoice: InvoiceRow
  client: BillableClient | null
  agency: AgencyInfo | null
  logoSrc: string | null
  onClose: () => void
  onUpdated: (patch: Partial<InvoiceRow> & { id: string }) => void
}

const eur = (n: number) => `${n.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €`
const fdate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('es-ES') : '—')

export function InvoiceDetail({ invoice, client, agency, logoSrc, onClose, onUpdated }: Props) {
  const [busy, setBusy] = useState<string | null>(null)
  const lines = (invoice.lines ?? []) as InvoiceLine[]
  const hasBreakdown = invoice.subtotal != null && lines.length > 0
  const canGeneratePdf = Boolean(client && agency && hasBreakdown)

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key)
    try {
      await fn()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  const generatePdf = () =>
    run('pdf', async () => {
      if (!client || !agency) return
      const { path } = await generateAndUploadPdf(invoice, client, agency, logoSrc)
      onUpdated({ id: invoice.id, pdf_url: path })
      toast.success('PDF generado')
    })

  const viewPdf = () =>
    run('view', async () => {
      const res = await fetch(`/api/invoices/${invoice.id}/pdf`)
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error(error ?? 'No se pudo obtener el PDF')
      }
      const { url } = await res.json()
      window.open(url, '_blank', 'noopener')
    })

  const send = (channel: 'email' | 'whatsapp') =>
    run(channel, async () => {
      const res = await fetch(`/api/invoices/${invoice.id}/send-${channel}`, { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? `Error al enviar por ${channel}`)
      onUpdated({
        id: invoice.id,
        sent_at: new Date().toISOString(),
        ...(invoice.status === 'pending' ? { status: 'sent' } : {}),
      })
      toast.success(channel === 'email' ? `Factura enviada a ${body.to}` : 'Factura enviada por WhatsApp')
    })

  const markPaid = () =>
    run('paid', async () => {
      const res = await fetch(`/api/invoices/${invoice.id}/paid`, { method: 'POST' })
      if (!res.ok) throw new Error('No se pudo marcar como pagada')
      onUpdated({ id: invoice.id, status: 'paid', paid_at: new Date().toISOString() })
      toast.success('Factura marcada como pagada')
    })

  const status = invoiceStatusStyle(invoice.status)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
          <div>
            <h2 className="font-serif text-xl text-ink-900">{invoice.invoice_number}</h2>
            <p className="text-xs text-ink-400">{invoice.business_name}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', status.badge)}>{status.label}</span>
            <button onClick={onClose} className="text-ink-400 hover:text-ink-700">✕</button>
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div><p className="text-xs text-ink-400">Importe</p><p className="font-medium text-ink-900">{invoice.amount.toLocaleString('es-ES')} €</p></div>
            <div><p className="text-xs text-ink-400">Vencimiento</p><p className="text-ink-700">{fdate(invoice.due_date)}</p></div>
            <div><p className="text-xs text-ink-400">Enviada</p><p className="text-ink-700">{fdate(invoice.sent_at)}</p></div>
            <div><p className="text-xs text-ink-400">Pagada</p><p className="text-ink-700">{fdate(invoice.paid_at)}</p></div>
          </div>

          {invoice.description && <p className="text-sm text-ink-600">{invoice.description}</p>}

          {hasBreakdown ? (
            <div className="overflow-hidden rounded-lg border border-ink-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-200 bg-ink-50 text-left text-[10px] font-semibold uppercase tracking-wide text-ink-400">
                    <th className="px-3 py-2">Concepto</th>
                    <th className="px-3 py-2 text-right">Cant.</th>
                    <th className="px-3 py-2 text-right">Precio</th>
                    <th className="px-3 py-2 text-right">IGIC</th>
                    <th className="px-3 py-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {lines.map((l, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 text-ink-900">{l.description}</td>
                      <td className="px-3 py-2 text-right text-ink-600">{l.quantity}</td>
                      <td className="px-3 py-2 text-right text-ink-600">{eur(l.unit_price)}</td>
                      <td className="px-3 py-2 text-right text-ink-600">{l.tax_rate}%</td>
                      <td className="px-3 py-2 text-right text-ink-900">{eur(l.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-ink-200 bg-ink-50 text-xs text-ink-600">
                  <tr><td colSpan={4} className="px-3 py-1.5 text-right">Subtotal</td><td className="px-3 py-1.5 text-right">{eur(invoice.subtotal ?? 0)}</td></tr>
                  <tr><td colSpan={4} className="px-3 py-1.5 text-right">IGIC</td><td className="px-3 py-1.5 text-right">{eur(invoice.tax_amount ?? 0)}</td></tr>
                  <tr><td colSpan={4} className="px-3 py-1.5 text-right">IRPF</td><td className="px-3 py-1.5 text-right">-{eur(invoice.irpf_amount ?? 0)}</td></tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <p className="rounded-md bg-ink-50 px-3 py-2 text-xs text-ink-500">
              Factura sin desglose de líneas (generada con el formato antiguo). Puede marcarse como pagada pero no genera PDF.
            </p>
          )}

          {invoice.notes && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Notas</p>
              <p className="mt-1 text-sm text-ink-600">{invoice.notes}</p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-ink-100 px-6 py-4">
          {canGeneratePdf && (
            <button onClick={generatePdf} disabled={!!busy} className="rounded-md border border-ink-300 px-3 py-2 text-sm text-ink-900 hover:bg-ink-50 disabled:opacity-50">
              {busy === 'pdf' ? 'Generando…' : invoice.pdf_url ? 'Regenerar PDF' : 'Generar PDF'}
            </button>
          )}
          {invoice.pdf_url && (
            <>
              <button onClick={viewPdf} disabled={!!busy} className="rounded-md border border-ink-300 px-3 py-2 text-sm text-ink-900 hover:bg-ink-50 disabled:opacity-50">
                {busy === 'view' ? 'Abriendo…' : 'Ver PDF'}
              </button>
              <button onClick={() => send('email')} disabled={!!busy} className="rounded-md bg-ink-900 px-3 py-2 text-sm font-medium text-white hover:bg-ink-800 disabled:opacity-50">
                {busy === 'email' ? 'Enviando…' : '✉ Enviar por email'}
              </button>
              <button onClick={() => send('whatsapp')} disabled={!!busy} className="rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
                {busy === 'whatsapp' ? 'Enviando…' : 'Enviar por WhatsApp'}
              </button>
            </>
          )}
          {invoice.status !== 'paid' && (
            <button onClick={markPaid} disabled={!!busy} className="rounded-md bg-green-50 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-100 disabled:opacity-50">
              {busy === 'paid' ? '…' : 'Marcar pagada'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
