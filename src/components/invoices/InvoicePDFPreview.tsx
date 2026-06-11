'use client'

import { PDFViewer } from '@react-pdf/renderer'
import { InvoicePDF, type InvoicePDFProps } from './InvoicePDF'

/**
 * Solo se importa vía next/dynamic con ssr:false — @react-pdf/renderer
 * no es SSR-safe.
 */
export default function InvoicePDFPreview(props: InvoicePDFProps) {
  return (
    <PDFViewer className="h-[480px] w-full rounded-lg border border-ink-200" showToolbar={false}>
      <InvoicePDF {...props} />
    </PDFViewer>
  )
}
