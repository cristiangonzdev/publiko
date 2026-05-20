'use client'

import { useState } from 'react'

const CONTENT_TYPES = [
  { value: 'reel', label: 'Reel' },
  { value: 'post', label: 'Post' },
  { value: 'story', label: 'Story' },
  { value: 'carrusel', label: 'Carrusel' },
] as const

interface Props {
  clientId: string
  onClose: () => void
  onCreated: (idea: Record<string, unknown>) => void
}

export function AddIdeaModal({ clientId, onClose, onCreated }: Props) {
  const [input, setInput] = useState('')
  const [contentType, setContentType] = useState<'reel' | 'post' | 'story' | 'carrusel'>('reel')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!input.trim()) return
    setLoading(true)
    try {
      const res = await fetch('/api/ideas/human', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, human_input: input.trim(), content_type: contentType }),
      })
      if (!res.ok) throw new Error(await res.text())
      const { idea } = await res.json() as { idea: Record<string, unknown> }
      onCreated({ ...idea, status: 'suggested', content_type: contentType, content_origin: 'human' })
      onClose()
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-xl bg-white shadow-2xl">
        <div className="border-b border-ink-100 px-6 py-4">
          <h2 className="text-base font-semibold text-ink-900">Añadir idea</h2>
          <p className="mt-0.5 text-sm text-ink-500">
            Describe el formato o la inspiración. Claude la adaptará a la marca.
          </p>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-600">
              ¿Qué idea has visto funcionar?
            </label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ej: vi un reel de un restaurante donde el dueño muestra cómo prepara el plato del día antes de abrir. Música lofi, planos de manos, sin hablar. Tuvo 200k reproducciones."
              rows={5}
              className="w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm text-ink-800 placeholder:text-ink-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-600">Formato</label>
            <div className="flex gap-2">
              {CONTENT_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setContentType(t.value)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    contentType === t.value
                      ? 'bg-ink-900 text-white'
                      : 'border border-ink-200 text-ink-500 hover:border-ink-400'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-ink-100 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-ink-600 hover:bg-ink-50"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={!input.trim() || loading}
            className="rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white hover:bg-ink-800 disabled:opacity-40"
          >
            {loading ? 'Generando…' : '✦ Convertir en idea'}
          </button>
        </div>
      </div>
    </div>
  )
}
