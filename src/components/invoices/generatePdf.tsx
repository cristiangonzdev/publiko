import type { InvoiceLine } from '@/types/supabase'
import { computeTotals } from '@/lib/invoices/totals'
import type { AgencyInfo, BillableClient, InvoiceRow } from './types'
import type { InvoicePDFProps } from './InvoicePDF'

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-ES') : ''

/** Construye las props del documento PDF a partir de los datos de la app. */
export function buildPdfProps(
  invoice: InvoiceRow,
  client: BillableClient,
  agency: AgencyInfo,
  logoSrc: string | null,
): InvoicePDFProps {
  const lines = (invoice.lines ?? []) as InvoiceLine[]
  return {
    invoiceNumber: invoice.invoice_number,
    issueDate: formatDate(invoice.created_at),
    dueDate: invoice.due_date ? formatDate(invoice.due_date) : null,
    agency,
    client,
    lines,
    // Si la factura ya tiene totales persistidos se respetan; si no
    // (caso raro), se recalculan con la misma fuente que el servidor.
    totals: invoice.subtotal != null
      ? {
          subtotal: invoice.subtotal,
          tax_amount: invoice.tax_amount ?? 0,
          irpf_amount: invoice.irpf_amount ?? 0,
          total: (invoice.subtotal ?? 0) + (invoice.tax_amount ?? 0) - (invoice.irpf_amount ?? 0),
        }
      : computeTotals(lines, agency.irpf_rate),
    irpfRate: agency.irpf_rate,
    notes: invoice.notes,
    logoSrc,
  }
}

/**
 * Genera el PDF en el browser y lo sube al bucket privado vía
 * POST /api/invoices/[id]/pdf. Imports dinámicos: @react-pdf/renderer
 * no es SSR-safe y solo debe cargarse al pulsar el botón.
 */
export async function generateAndUploadPdf(
  invoice: InvoiceRow,
  client: BillableClient,
  agency: AgencyInfo,
  logoSrc: string | null,
): Promise<{ path: string }> {
  const [{ pdf }, { InvoicePDF }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('./InvoicePDF'),
  ])

  const blob = await pdf(<InvoicePDF {...buildPdfProps(invoice, client, agency, logoSrc)} />).toBlob()

  const form = new FormData()
  form.append('file', blob, `${invoice.invoice_number}.pdf`)
  const res = await fetch(`/api/invoices/${invoice.id}/pdf`, { method: 'POST', body: form })
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(error ?? 'Error al subir el PDF')
  }
  return res.json()
}
