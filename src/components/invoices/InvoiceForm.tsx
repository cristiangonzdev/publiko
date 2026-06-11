'use client'

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'
import type { InvoiceLine } from '@/types/supabase'
import { computeTotals, normalizeLines } from '@/lib/invoices/totals'
import type { AgencyInfo, BillableClient, InvoiceRow } from './types'
import { buildPdfProps, generateAndUploadPdf } from './generatePdf'

const InvoicePDFPreview = dynamic(() => import('./InvoicePDFPreview'), {
  ssr: false,
  loading: () => <div className="flex h-[480px] items-center justify-center rounded-lg border border-ink-200 text-sm text-ink-400">Cargando preview…</div>,
})

interface Props {
  clients: BillableClient[]
  agency: AgencyInfo
  logoSrc: string | null
  onClose: () => void
  onCreated: (invoice: InvoiceRow) => void
}

const emptyLine = (taxRate: number): InvoiceLine => ({
  description: '',
  quantity: 1,
  unit_price: 0,
  tax_rate: taxRate,
  subtotal: 0,
})

const inputClass =
  'w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand'

const eur = (n: number) => `${n.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €`

export function InvoiceForm({ clients, agency, logoSrc, onClose, onCreated }: Props) {
  const [clientId, setClientId] = useState('')
  const [lines, setLines] = useState<InvoiceLine[]>([emptyLine(agency.igic_rate)])
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [saving, setSaving] = useState<'draft' | 'pdf' | null>(null)

  const client = clients.find((c) => c.id === clientId) ?? null
  const validLines = useMemo(() => normalizeLines(lines), [lines])
  const totals = useMemo(() => computeTotals(validLines, agency.irpf_rate), [validLines, agency.irpf_rate])
  const canSave = Boolean(client) && validLines.length > 0 && !saving

  const updateLine = (i: number, patch: Partial<InvoiceLine>) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))

  const save = async (generatePdf: boolean) => {
    if (!client) return
    setSaving(generatePdf ? 'pdf' : 'draft')
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: client.id,
          lines: validLines.map(({ description, quantity, unit_price, tax_rate }) => ({ description, quantity, unit_price, tax_rate })),
          description: description.trim() || null,
          notes: notes.trim() || null,
          due_date: dueDate || null,
        }),
      })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: res.statusText }))
        if (error === 'agency_settings_missing') {
          toast.error('Configura primero los datos de la agencia')
          window.location.href = '/admin/settings/agency'
          return
        }
        throw new Error(error ?? 'Error al crear la factura')
      }
      const { invoice } = (await res.json()) as { invoice: InvoiceRow }
      const row: InvoiceRow = { ...invoice, business_name: client.business_name, lines: validLines }

      if (generatePdf) {
        const { path } = await generateAndUploadPdf(row, client, agency, logoSrc)
        row.pdf_url = path
        toast.success(`Factura ${row.invoice_number} creada con PDF`)
      } else {
        toast.success(`Borrador ${row.invoice_number} guardado`)
      }
      onCreated(row)
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(null)
    }
  }

  // Para el preview se simula la factura aún sin guardar.
  const previewProps = client && validLines.length > 0
    ? buildPdfProps(
        {
          id: 'preview', client_id: client.id, business_name: client.business_name,
          invoice_number: `${'(borrador)'}`, amount: Math.round(totals.total),
          invoice_type: 'extra', status: 'pending', description: description || null,
          notes: notes || null, period_start: null, period_end: null,
          due_date: dueDate || null, paid_at: null, sent_at: null, pdf_url: null,
          lines: validLines, subtotal: totals.subtotal, tax_amount: totals.tax_amount,
          irpf_amount: totals.irpf_amount, created_at: new Date().toISOString(),
        },
        client, agency, logoSrc,
      )
    : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
          <h2 className="font-serif text-xl text-ink-900">Nueva factura</h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700">✕</button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div>
            <label className="block text-sm font-medium text-ink-700">Cliente *</label>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={`mt-1 ${inputClass}`}>
              <option value="">— Selecciona un cliente —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.business_name}</option>)}
            </select>
            {client && (
              <div className="mt-2 rounded-md bg-ink-50 px-3 py-2 text-xs text-ink-500">
                {client.fiscal_name || client.nif ? (
                  <>
                    <span className="font-medium text-ink-700">{client.fiscal_name ?? client.business_name}</span>
                    {client.nif && <> · NIF {client.nif}</>}
                    {client.fiscal_city && <> · {client.fiscal_city}</>}
                    {(client.billing_email || client.contact_email) && <> · {client.billing_email ?? client.contact_email}</>}
                  </>
                ) : (
                  <span className="text-orange-600">
                    Este cliente no tiene datos fiscales. La factura saldrá solo con el nombre comercial —
                    complétalos en su ficha de edición.
                  </span>
                )}
              </div>
            )}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="block text-sm font-medium text-ink-700">Líneas *</label>
              <button
                onClick={() => setLines((prev) => [...prev, emptyLine(agency.igic_rate)])}
                className="rounded border border-ink-200 px-2 py-1 text-xs text-ink-700 hover:bg-ink-50"
              >
                + Añadir línea
              </button>
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_64px_88px_64px_88px_28px] gap-2 text-[10px] font-semibold uppercase tracking-wide text-ink-400">
                <span>Concepto</span><span>Cant.</span><span>Precio €</span><span>IGIC %</span><span className="text-right">Subtotal</span><span />
              </div>
              {lines.map((line, i) => (
                <div key={i} className="grid grid-cols-[1fr_64px_88px_64px_88px_28px] items-center gap-2">
                  <input value={line.description} onChange={(e) => updateLine(i, { description: e.target.value })} placeholder="Descripción del servicio" className={inputClass} />
                  <input type="number" min="0" step="1" value={line.quantity} onChange={(e) => updateLine(i, { quantity: parseFloat(e.target.value) || 0 })} className={inputClass} />
                  <input type="number" min="0" step="0.01" value={line.unit_price} onChange={(e) => updateLine(i, { unit_price: parseFloat(e.target.value) || 0 })} className={inputClass} />
                  <input type="number" min="0" step="0.01" value={line.tax_rate} onChange={(e) => updateLine(i, { tax_rate: parseFloat(e.target.value) || 0 })} className={inputClass} />
                  <span className="text-right text-sm text-ink-700">{eur((line.quantity || 0) * (line.unit_price || 0))}</span>
                  <button
                    onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
                    disabled={lines.length === 1}
                    className="text-ink-300 hover:text-red-500 disabled:opacity-30"
                    title="Eliminar línea"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-ink-700">Descripción</label>
              <input value={description} onChange={(e) => setDescription(e.target.value)} className={`mt-1 ${inputClass}`} placeholder="Servicio de gestión de redes — junio" />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-700">Vencimiento</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={`mt-1 ${inputClass}`} />
              <p className="mt-1 text-[11px] text-ink-400">Vacío = {agency.payment_terms_days} días desde hoy</p>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-ink-700">Notas (aparecen en el PDF)</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`mt-1 ${inputClass}`} />
            </div>
          </div>

          <div className="rounded-lg border border-ink-200 bg-ink-50 px-4 py-3">
            <div className="ml-auto w-full max-w-xs space-y-1 text-sm">
              <div className="flex justify-between text-ink-600"><span>Subtotal</span><span>{eur(totals.subtotal)}</span></div>
              <div className="flex justify-between text-ink-600"><span>IGIC</span><span>{eur(totals.tax_amount)}</span></div>
              <div className="flex justify-between text-ink-600"><span>IRPF (-{agency.irpf_rate}%)</span><span>-{eur(totals.irpf_amount)}</span></div>
              <div className="flex justify-between border-t border-ink-200 pt-1 font-semibold text-ink-900"><span>Total</span><span>{eur(totals.total)}</span></div>
            </div>
          </div>

          {previewProps && (
            <div>
              <button
                onClick={() => setShowPreview((v) => !v)}
                className="mb-2 rounded border border-ink-200 px-3 py-1.5 text-xs text-ink-700 hover:bg-ink-50"
              >
                {showPreview ? 'Ocultar preview' : '👁 Preview del PDF'}
              </button>
              {showPreview && <InvoicePDFPreview {...previewProps} />}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-ink-100 px-6 py-4">
          <button onClick={onClose} className="rounded-md border border-ink-200 px-4 py-2 text-sm text-ink-700 hover:bg-ink-50">
            Cancelar
          </button>
          <button
            onClick={() => save(false)}
            disabled={!canSave}
            className="rounded-md border border-ink-300 bg-white px-4 py-2 text-sm font-medium text-ink-900 hover:bg-ink-50 disabled:opacity-50"
          >
            {saving === 'draft' ? 'Guardando…' : 'Guardar borrador'}
          </button>
          <button
            onClick={() => save(true)}
            disabled={!canSave}
            className="rounded-md bg-ink-900 px-4 py-2 text-sm font-medium text-white hover:bg-ink-800 disabled:opacity-50"
          >
            {saving === 'pdf' ? 'Generando…' : 'Guardar y generar PDF'}
          </button>
        </div>
      </div>
    </div>
  )
}
