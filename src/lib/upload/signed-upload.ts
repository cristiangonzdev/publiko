import { createClient } from '@/lib/supabase/client'

interface PreparedUpload {
  bucket: string
  path: string
  token: string
}

interface UploadResult {
  asset_id: string
  public_url: string | null
}

/**
 * Upload a file via Supabase signed URL — bypasses Vercel's 4.5MB route body limit.
 *
 * Flow:
 *   1. POST prepareEndpoint → backend returns { bucket, path, token }
 *   2. Client uploads file directly to Supabase Storage with that token
 *   3. POST confirmEndpoint with { path, file_name, file_type, file_size, ...extra } → backend
 *      registers the asset, updates related records, triggers notifications
 */
export async function uploadViaSignedUrl(params: {
  prepareEndpoint: string
  confirmEndpoint: string
  file: File
  extraConfirm?: Record<string, unknown>
}): Promise<UploadResult> {
  const { prepareEndpoint, confirmEndpoint, file, extraConfirm } = params

  // 1. Ask backend for a signed upload URL
  const prepareRes = await fetch(prepareEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      file_name: file.name,
      file_type: file.type,
      file_size: file.size,
    }),
  })
  if (!prepareRes.ok) {
    const text = await prepareRes.text()
    throw new Error(`prepare failed: ${text}`)
  }
  const prepared = await prepareRes.json() as PreparedUpload
  if (!prepared.bucket || !prepared.path || !prepared.token) {
    throw new Error('Invalid prepare response')
  }

  // 2. Direct upload to Supabase Storage using the signed token
  const supabase = createClient()
  const { error: uploadError } = await supabase.storage
    .from(prepared.bucket)
    .uploadToSignedUrl(prepared.path, prepared.token, file, {
      contentType: file.type,
      upsert: false,
    })
  if (uploadError) throw uploadError

  // 3. Confirm so backend registers the asset and triggers side effects
  const confirmRes = await fetch(confirmEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      path: prepared.path,
      file_name: file.name,
      file_type: file.type,
      file_size: file.size,
      ...(extraConfirm ?? {}),
    }),
  })
  if (!confirmRes.ok) {
    const text = await confirmRes.text()
    throw new Error(`confirm failed: ${text}`)
  }
  return await confirmRes.json() as UploadResult
}
