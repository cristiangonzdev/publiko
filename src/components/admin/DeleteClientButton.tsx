'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  clientId: string
  businessName: string
}

export function DeleteClientButton({ clientId, businessName }: Props) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [typed, setTyped] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canDelete = typed.trim().toLowerCase() === businessName.trim().toLowerCase()

  const handleDelete = async () => {
    if (!canDelete) return
    setDeleting(true)
    setError(null)
    try {
      const res = await fetch(`/api/clients/${clientId}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? `Error ${res.status}`)
      }
      router.push('/admin/clients')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setDeleting(false)
    }
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
      >
        Eliminar cliente
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
        <h2 className="font-serif text-xl text-ink-900">Eliminar cliente</h2>
        <p className="mt-2 text-sm text-ink-600">
          Esta acción marca <span className="font-semibold">{businessName}</span> como dado de baja: deja de contar en el MRR,
          desaparece de listados y deja de generar contenido. El histórico se conserva.
        </p>
        <p className="mt-3 text-xs text-ink-500">
          Para confirmar, escribe el nombre exacto del negocio:
        </p>
        <input
          type="text"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={businessName}
          className="mt-2 w-full rounded-md border border-ink-200 px-3 py-2 text-sm focus:border-brand focus:outline-none"
          autoFocus
        />
        {error && (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => { setConfirming(false); setTyped(''); setError(null) }}
            disabled={deleting}
            className="rounded-md border border-ink-200 px-4 py-2 text-sm text-ink-700 hover:bg-ink-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!canDelete || deleting}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {deleting ? 'Eliminando…' : 'Eliminar definitivamente'}
          </button>
        </div>
      </div>
    </div>
  )
}
