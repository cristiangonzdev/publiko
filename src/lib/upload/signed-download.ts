import { createServiceClient } from '@/lib/supabase/server'

const DEFAULT_BUCKET = 'assets'
const DEFAULT_TTL = 3600 // 1 hora

/**
 * Genera una signed URL temporal para un objeto de un bucket privado
 * ('assets' por defecto; 'invoices' para los PDFs de facturas).
 * Los buckets dejaron de ser públicos (migrations 0014/0017): nunca se
 * almacenan URLs permanentes; las descargas se firman bajo demanda.
 */
export async function createSignedDownloadUrl(
  storagePath: string,
  expiresIn: number = DEFAULT_TTL,
  bucket: string = DEFAULT_BUCKET,
): Promise<string | null> {
  if (!storagePath) return null
  const service = await createServiceClient()
  const { data, error } = await service.storage.from(bucket).createSignedUrl(storagePath, expiresIn)
  if (error || !data) return null
  return data.signedUrl
}

/** Firma varios paths de una sola vez (una llamada a Storage). */
export async function createSignedDownloadUrls(
  storagePaths: string[],
  expiresIn: number = DEFAULT_TTL,
  bucket: string = DEFAULT_BUCKET,
): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  const paths = storagePaths.filter(Boolean)
  if (paths.length === 0) return result
  const service = await createServiceClient()
  const { data, error } = await service.storage.from(bucket).createSignedUrls(paths, expiresIn)
  if (error || !data) return result
  for (const item of data) {
    if (item.signedUrl && item.path) result.set(item.path, item.signedUrl)
  }
  return result
}
