'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

interface ReviewItem {
  id: string
  title: string
  business_name: string
  status: string
  deadline: string | null
  copy_selected: string | null
  revision_notes: string | null
  revision_count: number
  final_asset_id: string | null
  target_platforms: string[]
  publish_at: string | null
}

interface Props {
  initialItems: ReviewItem[]
}

export function ReviewList({ initialItems }: Props) {
  const [items, setItems] = useState(initialItems)
  const [revisionNote, setRevisionNote] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState<string | null>(null)
  const [publishAt, setPublishAt] = useState<Record<string, string>>({})

  const approve = async (taskId: string) => {
    setLoading(taskId)
    try {
      await fetch(`/api/tasks/${taskId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      })
      setItems((prev) => prev.filter((i) => i.id !== taskId))
    } finally {
      setLoading(null)
    }
  }

  const sendToRevision = async (taskId: string) => {
    const note = revisionNote[taskId]
    if (!note?.trim()) { alert('Escribe una nota para el editor'); return }
    setLoading(taskId)
    try {
      await fetch(`/api/tasks/${taskId}/revision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
      })
      setItems((prev) => prev.map((i) => i.id === taskId ? { ...i, status: 'revision', revision_notes: note } : i))
      setRevisionNote((prev) => ({ ...prev, [taskId]: '' }))
    } finally {
      setLoading(null)
    }
  }

  const schedule = async (taskId: string) => {
    const dt = publishAt[taskId]
    if (!dt) { alert('Elige una fecha de publicación'); return }
    setLoading(taskId)
    try {
      // El <input datetime-local> da hora local del navegador (Madrid para el equipo);
      // se envía como ISO y el backend la guarda como instante.
      const res = await fetch(`/api/tasks/${taskId}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publish_at: new Date(dt).toISOString() }),
      })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Error al programar' }))
        alert(error ?? 'Error al programar')
        return
      }
      // Programada: sale de la cola de revisión.
      setItems((prev) => prev.filter((i) => i.id !== taskId))
    } finally {
      setLoading(null)
    }
  }

  if (items.length === 0) {
    return (
      <p className="mt-8 text-sm text-ink-400">Sin entregables pendientes. ¡Todo al día!</p>
    )
  }

  return (
    <div className="mt-6 space-y-5">
      {items.map((item) => (
        <div key={item.id} className={cn(
          'rounded-xl border bg-white shadow-sm overflow-hidden',
          item.status === 'revision' ? 'border-orange-200' : 'border-ink-200'
        )}>
          <div className="px-6 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-brand">{item.business_name}</p>
                <h2 className="mt-0.5 font-medium text-ink-900">{item.title}</h2>
                <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-ink-400">
                  {item.target_platforms.map((p) => (
                    <span key={p} className="rounded-full bg-ink-100 px-2 py-0.5">{p}</span>
                  ))}
                  {item.revision_count > 0 && (
                    <span className="text-orange-500">Revisión #{item.revision_count}</span>
                  )}
                </div>
              </div>

              <div className="text-right flex-shrink-0">
                <span className={cn(
                  'rounded-full px-2.5 py-0.5 text-xs font-medium',
                  item.status === 'revision' ? 'bg-orange-50 text-orange-700' : 'bg-blue-50 text-blue-700'
                )}>
                  {item.status === 'revision' ? 'En revisión' : 'Entregado'}
                </span>
                {item.deadline && (
                  <p className="mt-1 text-[11px] text-ink-400">
                    {new Date(item.deadline).toLocaleDateString('es-ES')}
                  </p>
                )}
              </div>
            </div>

            {item.final_asset_id && (
              <div className="mt-3 rounded-lg bg-ink-50 py-8 text-center text-xs text-ink-400">
                [Reproductor de vídeo — {item.final_asset_id}]
              </div>
            )}

            {item.copy_selected && (
              <div className="mt-3 rounded bg-blue-50 px-4 py-3 text-sm text-blue-900">
                <p className="font-semibold text-xs uppercase tracking-wide text-blue-500 mb-1">Copy</p>
                <p className="whitespace-pre-wrap">{item.copy_selected}</p>
              </div>
            )}

            {item.revision_notes && (
              <div className="mt-3 rounded bg-orange-50 px-4 py-3 text-sm text-orange-800">
                <p className="font-semibold text-xs uppercase tracking-wide text-orange-500 mb-1">Nota de revisión anterior</p>
                <p>{item.revision_notes}</p>
              </div>
            )}

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <p className="text-xs font-medium text-ink-500">Fecha de publicación</p>
                <div className="flex gap-2">
                  <input
                    type="datetime-local"
                    value={publishAt[item.id] ?? item.publish_at?.slice(0, 16) ?? ''}
                    onChange={(e) => setPublishAt((prev) => ({ ...prev, [item.id]: e.target.value }))}
                    className="flex-1 rounded border border-ink-200 px-3 py-1.5 text-sm"
                  />
                  <button
                    onClick={() => schedule(item.id)}
                    disabled={loading === item.id}
                    className="rounded bg-teal-600 px-3 py-1.5 text-xs text-white hover:bg-teal-700 disabled:opacity-50"
                  >
                    Programar
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-ink-500">Nota para el editor (si hay cambios)</p>
                <input
                  type="text"
                  placeholder="Ej: Acorta el final 3 segundos"
                  value={revisionNote[item.id] ?? ''}
                  onChange={(e) => setRevisionNote((prev) => ({ ...prev, [item.id]: e.target.value }))}
                  className="w-full rounded border border-ink-200 px-3 py-1.5 text-sm"
                />
              </div>
            </div>

            <div className="mt-4 flex gap-3">
              <button
                onClick={() => approve(item.id)}
                disabled={loading === item.id}
                className="flex-1 rounded-md bg-green-600 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                ✅ Aprobar
              </button>
              <button
                onClick={() => sendToRevision(item.id)}
                disabled={loading === item.id}
                className="flex-1 rounded-md border border-ink-200 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-50"
              >
                ✏️ Devolver con nota
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
