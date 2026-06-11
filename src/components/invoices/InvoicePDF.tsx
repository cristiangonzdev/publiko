import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'
import type { InvoiceLine } from '@/types/supabase'
import type { InvoiceTotals } from '@/lib/invoices/totals'

export interface InvoicePDFAgency {
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
}

export interface InvoicePDFClient {
  fiscal_name: string | null
  business_name: string
  nif: string | null
  fiscal_address: string | null
  fiscal_city: string | null
  fiscal_postal_code: string | null
  fiscal_country: string | null
}

export interface InvoicePDFProps {
  invoiceNumber: string
  issueDate: string
  dueDate: string | null
  agency: InvoicePDFAgency
  client: InvoicePDFClient
  lines: InvoiceLine[]
  totals: InvoiceTotals
  irpfRate: number
  notes: string | null
  /**
   * URL del logo YA resuelta (https pública o signed URL generada server-side).
   * null → se renderiza solo el nombre de la agencia, nunca rompe la generación.
   */
  logoSrc: string | null
}

const colors = {
  ink: '#1a1a1a',
  gray: '#666666',
  light: '#999999',
  border: '#e5e5e5',
  bg: '#f7f7f6',
}

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 9, fontFamily: 'Helvetica', color: colors.ink },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 28 },
  logo: { maxHeight: 48, maxWidth: 160, objectFit: 'contain' },
  agencyName: { fontSize: 16, fontFamily: 'Helvetica-Bold' },
  invoiceTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  invoiceNumber: { fontSize: 11, color: colors.gray, textAlign: 'right', marginTop: 4 },
  metaRight: { fontSize: 9, color: colors.gray, textAlign: 'right', marginTop: 2 },
  parties: { flexDirection: 'row', gap: 24, marginBottom: 28 },
  party: { flex: 1, padding: 12, backgroundColor: colors.bg, borderRadius: 4 },
  partyLabel: { fontSize: 7, color: colors.light, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  partyName: { fontSize: 10, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  partyLine: { fontSize: 8.5, color: colors.gray, marginBottom: 1.5 },
  table: { marginBottom: 20 },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1.5, borderBottomColor: colors.ink, paddingBottom: 5, marginBottom: 2 },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: colors.border, paddingVertical: 6 },
  colDesc: { flex: 5 },
  colQty: { flex: 1, textAlign: 'right' },
  colPrice: { flex: 1.5, textAlign: 'right' },
  colTax: { flex: 1, textAlign: 'right' },
  colSubtotal: { flex: 1.5, textAlign: 'right' },
  th: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: colors.gray, textTransform: 'uppercase' },
  totalsBox: { alignSelf: 'flex-end', width: 220 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  totalLabel: { color: colors.gray },
  grandTotal: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1.5, borderTopColor: colors.ink, marginTop: 4, paddingTop: 6 },
  grandTotalText: { fontSize: 12, fontFamily: 'Helvetica-Bold' },
  footer: { position: 'absolute', bottom: 40, left: 48, right: 48 },
  footerBlock: { marginBottom: 8 },
  footerLabel: { fontSize: 7, color: colors.light, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 },
  footerText: { fontSize: 8.5, color: colors.gray },
})

const eur = (n: number) =>
  `${n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`

export function InvoicePDF({
  invoiceNumber, issueDate, dueDate, agency, client, lines, totals, irpfRate, notes, logoSrc,
}: InvoicePDFProps) {
  const clientName = client.fiscal_name || client.business_name
  const agencyAddress = [agency.address, [agency.postal_code, agency.city].filter(Boolean).join(' '), agency.country]
    .filter(Boolean)
  const clientAddress = [client.fiscal_address, [client.fiscal_postal_code, client.fiscal_city].filter(Boolean).join(' '), client.fiscal_country]
    .filter(Boolean)

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            {logoSrc
              ? <Image src={logoSrc} style={styles.logo} />
              : <Text style={styles.agencyName}>{agency.agency_name}</Text>}
          </View>
          <View>
            <Text style={styles.invoiceTitle}>FACTURA</Text>
            <Text style={styles.invoiceNumber}>{invoiceNumber}</Text>
            <Text style={styles.metaRight}>Fecha: {issueDate}</Text>
            {dueDate && <Text style={styles.metaRight}>Vencimiento: {dueDate}</Text>}
          </View>
        </View>

        <View style={styles.parties}>
          <View style={styles.party}>
            <Text style={styles.partyLabel}>Emisor</Text>
            <Text style={styles.partyName}>{agency.agency_name}</Text>
            <Text style={styles.partyLine}>NIF: {agency.nif}</Text>
            {agencyAddress.map((l, i) => <Text key={i} style={styles.partyLine}>{l}</Text>)}
            {agency.email && <Text style={styles.partyLine}>{agency.email}</Text>}
            {agency.phone && <Text style={styles.partyLine}>{agency.phone}</Text>}
          </View>
          <View style={styles.party}>
            <Text style={styles.partyLabel}>Cliente</Text>
            <Text style={styles.partyName}>{clientName}</Text>
            {client.nif && <Text style={styles.partyLine}>NIF: {client.nif}</Text>}
            {clientAddress.map((l, i) => <Text key={i} style={styles.partyLine}>{l}</Text>)}
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.colDesc, styles.th]}>Concepto</Text>
            <Text style={[styles.colQty, styles.th]}>Cant.</Text>
            <Text style={[styles.colPrice, styles.th]}>Precio</Text>
            <Text style={[styles.colTax, styles.th]}>IGIC</Text>
            <Text style={[styles.colSubtotal, styles.th]}>Subtotal</Text>
          </View>
          {lines.map((line, i) => (
            <View key={i} style={styles.row}>
              <Text style={styles.colDesc}>{line.description}</Text>
              <Text style={styles.colQty}>{line.quantity}</Text>
              <Text style={styles.colPrice}>{eur(line.unit_price)}</Text>
              <Text style={styles.colTax}>{line.tax_rate}%</Text>
              <Text style={styles.colSubtotal}>{eur(line.subtotal)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totalsBox}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text>{eur(totals.subtotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>IGIC</Text>
            <Text>{eur(totals.tax_amount)}</Text>
          </View>
          {totals.irpf_amount > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>IRPF (-{irpfRate}%)</Text>
              <Text>-{eur(totals.irpf_amount)}</Text>
            </View>
          )}
          <View style={styles.grandTotal}>
            <Text style={styles.grandTotalText}>TOTAL</Text>
            <Text style={styles.grandTotalText}>{eur(totals.total)}</Text>
          </View>
        </View>

        <View style={styles.footer}>
          {agency.iban && (
            <View style={styles.footerBlock}>
              <Text style={styles.footerLabel}>Forma de pago — transferencia bancaria</Text>
              <Text style={styles.footerText}>IBAN: {agency.iban}</Text>
              <Text style={styles.footerText}>Plazo de pago: {agency.payment_terms_days} días</Text>
            </View>
          )}
          {notes && (
            <View style={styles.footerBlock}>
              <Text style={styles.footerLabel}>Notas</Text>
              <Text style={styles.footerText}>{notes}</Text>
            </View>
          )}
        </View>
      </Page>
    </Document>
  )
}
