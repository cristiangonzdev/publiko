'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface MarkButtonProps {
  postId: string
  alreadyWinner?: boolean
}

export function MarkWinnerButton({ postId, alreadyWinner }: MarkButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (reason.trim().length < 5) {
      setError('Explica brevemente por qué funcionó')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/posts/${postId}/mark-winner`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Error al guardar')
        setSubmitting(false)
        return
      }
      setOpen(false)
      setReason('')
      router.refresh()
    } catch {
      setError('Error de red')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-ink-200 px-2.5 py-1 text-xs text-ink-700 hover:bg-yellow-50 hover:border-yellow-300"
      >
        {alreadyWinner ? '⭐ Añadir nota' : '⭐ Funcionó porque...'}
      </button>
    )
  }

  return (
    <div className="rounded-md border border-yellow-300 bg-yellow-50 p-3 space-y-2 max-w-md">
      <label className="block text-[11px] font-medium uppercase tracking-wide text-ink-500">
        ¿Por qué funcionó este post?
      </label>
      <textarea
        autoFocus
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="ej: el gancho de empezar con pregunta directa, plano cenital del plato, frase final pidiendo opinión..."
        className="w-full rounded border border-ink-200 px-2 py-1.5 text-sm focus:border-brand focus:outline-none"
        rows={3}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={() => { setOpen(false); setReason(''); setError(null) }}
          className="text-xs text-ink-500 hover:text-ink-700 px-2"
          disabled={submitting}
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="rounded bg-brand px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? 'Guardando...' : 'Guardar patrón'}
        </button>
      </div>
    </div>
  )
}

export function ArchivePatternButton({ patternId }: { patternId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function archive() {
    if (!confirm('¿Descartar este patrón? Dejará de influir en la generación.')) return
    setBusy(true)
    const reason = window.prompt('Razón (opcional):') ?? null
    const res = await fetch(`/api/winning-patterns/${patternId}/archive`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason }),
    })
    setBusy(false)
    if (res.ok) router.refresh()
  }

  return (
    <button
      type="button"
      onClick={archive}
      disabled={busy}
      className="text-[11px] text-ink-400 hover:text-red-600 disabled:opacity-50"
    >
      Descartar
    </button>
  )
}
