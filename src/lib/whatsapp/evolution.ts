/**
 * Cliente mínimo de Evolution API (WhatsApp) para envío de documentos.
 * Las tres vars son opcionales (src/lib/env.ts): sin configurar,
 * isEvolutionConfigured() devuelve false y los endpoints responden 503.
 */

export function isEvolutionConfigured(): boolean {
  return Boolean(
    process.env.EVOLUTION_API_URL &&
    process.env.EVOLUTION_API_KEY &&
    process.env.EVOLUTION_INSTANCE
  )
}

/** Deja el teléfono en dígitos con prefijo de país (formato que espera Evolution). */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  // Números españoles de 9 cifras sin prefijo → añadir 34.
  return digits.length === 9 ? `34${digits}` : digits
}

export async function sendDocument(
  phone: string,
  documentUrl: string,
  caption: string,
  fileName: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!isEvolutionConfigured()) return { ok: false, error: 'Evolution API no configurada' }

  const base = process.env.EVOLUTION_API_URL!.replace(/\/$/, '')
  const instance = process.env.EVOLUTION_INSTANCE!

  try {
    const res = await fetch(`${base}/message/sendMedia/${encodeURIComponent(instance)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: process.env.EVOLUTION_API_KEY!,
      },
      body: JSON.stringify({
        number: normalizePhone(phone),
        mediatype: 'document',
        media: documentUrl,
        caption,
        fileName,
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { ok: false, error: `Evolution API ${res.status}: ${body.slice(0, 300)}` }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
