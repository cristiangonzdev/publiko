import type { InvoiceLine } from '@/types/supabase'

/** Fila de factura tal y como la consumen InvoiceManager/Form/Detail. */
export interface InvoiceRow {
  id: string
  client_id: string
  business_name: string
  invoice_number: string
  amount: number
  invoice_type: string
  status: string
  description: string | null
  notes: string | null
  period_start: string | null
  period_end: string | null
  due_date: string | null
  paid_at: string | null
  sent_at: string | null
  pdf_url: string | null
  lines: InvoiceLine[]
  subtotal: number | null
  tax_amount: number | null
  irpf_amount: number | null
  created_at: string
}

/** Cliente activo con los datos necesarios para facturar. */
export interface BillableClient {
  id: string
  business_name: string
  monthly_fee: number
  billing_day: number
  contact_email: string | null
  billing_email: string | null
  contact_phone: string | null
  contact_whatsapp: string | null
  fiscal_name: string | null
  nif: string | null
  fiscal_address: string | null
  fiscal_city: string | null
  fiscal_postal_code: string | null
  fiscal_country: string | null
}

/** Subconjunto de agency_settings que necesitan el formulario y el PDF. */
export interface AgencyInfo {
  agency_name: string
  nif: string
  address: string | null
  city: string | null
  postal_code: string | null
  country: string
  email: string | null
  phone: string | null
  iban: string | null
  payment_terms_days: number
  igic_rate: number
  irpf_rate: number
}
