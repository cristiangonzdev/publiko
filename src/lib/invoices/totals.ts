import type { InvoiceLine } from '@/types/supabase'

export interface InvoiceTotals {
  subtotal: number
  tax_amount: number
  irpf_amount: number
  total: number
}

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Única fuente de verdad del cálculo de factura: la usan el formulario
 * (cálculo en vivo) y las API routes (recalcular server-side, nunca
 * confiar en totales que vengan del cliente).
 *
 * Total = subtotal + IGIC (por línea, según tax_rate) - IRPF (sobre el subtotal).
 */
export function computeTotals(lines: InvoiceLine[], irpfRate: number): InvoiceTotals {
  const subtotal = round2(lines.reduce((s, l) => s + lineSubtotal(l), 0))
  const tax_amount = round2(lines.reduce((s, l) => s + lineSubtotal(l) * ((l.tax_rate || 0) / 100), 0))
  const irpf_amount = round2(subtotal * ((irpfRate || 0) / 100))
  return { subtotal, tax_amount, irpf_amount, total: round2(subtotal + tax_amount - irpf_amount) }
}

export function lineSubtotal(line: Pick<InvoiceLine, 'quantity' | 'unit_price'>): number {
  return round2((line.quantity || 0) * (line.unit_price || 0))
}

/** Normaliza líneas recibidas del formulario: recalcula subtotales y descarta vacías. */
export function normalizeLines(lines: InvoiceLine[]): InvoiceLine[] {
  return lines
    .filter((l) => l.description.trim() && (l.quantity || 0) > 0)
    .map((l) => ({
      description: l.description.trim(),
      quantity: l.quantity,
      unit_price: l.unit_price,
      tax_rate: l.tax_rate,
      subtotal: lineSubtotal(l),
    }))
}
