'use client'

import { useEffect, useState } from 'react'
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
  clientName: string
  onClose: () => void
}

function formatBytes(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function BrollsPanel({ clientId, clientName, onClose }: Props) {
  const [brolls, setBrolls] = useState<Broll[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

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

  const filtered = query
    ? brolls.filter((b) =>
        b.file_name.toLowerCase().includes(query.toLowerCase()) ||
        (b.description ?? '').toLowerCase().includes(query.toLowerCase()) ||
        (b.tags ?? []).some((t) => t.toLowerCase().includes(query.toLowerCase()))
      )
    : brolls

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-2xl flex-col overflow-hidden bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-ink-100 px-4 md:px-6 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-brand">B-rolls</p>
            <h2 className="mt-1 font-serif text-xl text-ink-900">{clientName}</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="border-b border-ink-100 px-6 py-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, descripción o tag…"
            className="w-full rounded-md border border-ink-200 px-3 py-2 text-sm focus:border-brand focus:outline-none"
          />
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading && <p className="text-sm text-ink-400">Cargando…</p>}
          {!loading && filtered.length === 0 && (
            <p className="rounded-md border border-dashed border-ink-200 py-12 text-center text-sm text-ink-400">
              {query ? 'Sin coincidencias.' : 'Este cliente aún no tiene b-rolls.'}
            </p>
          )}

          {filtered.length > 0 && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {filtered.map((b) => {
                const isVideo = b.file_type.startsWith('video/')
                const isImage = b.file_type.startsWith('image/')
                return (
                  <div key={b.id} className={cn('overflow-hidden rounded-lg border border-ink-200 bg-white')}>
                    <div className="aspect-square bg-ink-100">
                      {isImage && b.signed_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={b.signed_url} alt={b.file_name} className="h-full w-full object-cover" />
                      )}
                      {isVideo && b.signed_url && (
                        <video src={b.signed_url} className="h-full w-full object-cover" muted controls preload="metadata" />
                      )}
                    </div>
                    <div className="p-2">
                      <p className="truncate text-[11px] font-medium text-ink-700">{b.file_name}</p>
                      <div className="mt-0.5 flex items-center justify-between">
                        <span className="text-[10px] text-ink-400">{formatBytes(b.file_size)}</span>
                        {b.signed_url && (
                          <a
                            href={b.signed_url}
                            download={b.file_name}
                            className="text-[10px] font-medium text-brand hover:underline"
                          >
                            ↓ Descargar
                          </a>
                        )}
                      </div>
                      {b.description && (
                        <p className="mt-1 line-clamp-2 text-[10px] text-ink-500">{b.description}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
