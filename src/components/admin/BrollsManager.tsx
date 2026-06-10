'use client'

import { useEffect, useRef, useState } from 'react'
import { uploadViaSignedUrl } from '@/lib/upload/signed-upload'
import { cn } from '@/lib/utils'

interface Broll {
  id: string
  file_name: string
  file_type: string
  file_size: number | null
  signed_url: string | null
  storage_path: string
  description: string | null
  tags: string[] | null
  created_at: string
}

interface Props {
  clientId: string
}

function formatBytes(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function isVideo(type: string) {
  return type.startsWith('video/')
}

function isImage(type: string) {
  return type.startsWith('image/')
}

export function BrollsManager({ clientId }: Props) {
  const [brolls, setBrolls] = useState<Broll[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadMessage, setUploadMessage] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/clients/${clientId}/brolls`)
        if (res.ok) {
          const { brolls: list } = await res.json() as { brolls: Broll[] }
          setBrolls(list)
        }
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [clientId])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    setUploading(true)

    let uploaded = 0
    for (const file of Array.from(files)) {
      setUploadMessage(`Subiendo ${file.name} (${uploaded + 1}/${files.length})…`)
      try {
        await uploadViaSignedUrl({
          prepareEndpoint: `/api/clients/${clientId}/brolls/prepare`,
          confirmEndpoint: `/api/clients/${clientId}/brolls/confirm`,
          file,
        })
        uploaded += 1
      } catch (err) {
        alert(`Error subiendo ${file.name}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    // Refresh list once at the end
    const listRes = await fetch(`/api/clients/${clientId}/brolls`)
    if (listRes.ok) {
      const { brolls: list } = await listRes.json() as { brolls: Broll[] }
      setBrolls(list)
    }

    setUploadMessage(`✓ ${uploaded} archivo${uploaded === 1 ? '' : 's'} subido${uploaded === 1 ? '' : 's'}`)
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
    setTimeout(() => setUploadMessage(null), 3000)
  }

  const deleteBroll = async (id: string) => {
    if (!confirm('¿Eliminar este b-roll? El editor ya no lo verá.')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/clients/${clientId}/brolls/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(await res.text())
      setBrolls((prev) => prev.filter((b) => b.id !== id))
    } catch (err) {
      alert(`Error eliminando: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <section className="rounded-lg border border-ink-200 bg-white">
      <input
        ref={fileRef}
        type="file"
        multiple
        accept="video/*,image/*"
        className="hidden"
        onChange={handleUpload}
      />

      <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-400">Banco de B-rolls</h2>
          <p className="mt-0.5 text-[11px] text-ink-400">Recursos visuales reutilizables que el editor verá en cada tarea de este cliente.</p>
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="rounded-md bg-ink-900 px-3 py-2 text-xs font-medium text-white hover:bg-ink-800 disabled:opacity-50"
        >
          {uploading ? (uploadMessage ?? 'Subiendo…') : '+ Subir b-rolls'}
        </button>
      </div>

      {uploadMessage && !uploading && (
        <div className="border-b border-ink-100 bg-green-50 px-5 py-2 text-xs text-green-700">{uploadMessage}</div>
      )}

      <div className="p-5">
        {loading && <p className="text-sm text-ink-400">Cargando…</p>}
        {!loading && brolls.length === 0 && (
          <p className="rounded-md border border-dashed border-ink-200 py-8 text-center text-sm text-ink-400">
            Sin b-rolls. Sube fotos o vídeos reutilizables que el editor pueda incorporar a cualquier pieza.
          </p>
        )}

        {brolls.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {brolls.map((b) => (
              <div key={b.id} className="group relative overflow-hidden rounded-lg border border-ink-200 bg-ink-50">
                <div className="aspect-square bg-ink-100">
                  {isImage(b.file_type) && b.signed_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.signed_url} alt={b.file_name} className="h-full w-full object-cover" />
                  )}
                  {isVideo(b.file_type) && b.signed_url && (
                    <video src={b.signed_url} className="h-full w-full object-cover" muted preload="metadata" />
                  )}
                  {!isImage(b.file_type) && !isVideo(b.file_type) && (
                    <div className="flex h-full items-center justify-center text-xs text-ink-400">📄</div>
                  )}
                </div>
                <div className="p-2">
                  <p className="truncate text-[11px] font-medium text-ink-700">{b.file_name}</p>
                  <p className="text-[10px] text-ink-400">{formatBytes(b.file_size)}</p>
                </div>
                <button
                  onClick={() => deleteBroll(b.id)}
                  disabled={deletingId === b.id}
                  className={cn(
                    'absolute right-1.5 top-1.5 rounded-full bg-white/90 p-1 text-ink-500 opacity-0 transition-opacity group-hover:opacity-100',
                    deletingId === b.id && 'opacity-100'
                  )}
                  title="Eliminar"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
