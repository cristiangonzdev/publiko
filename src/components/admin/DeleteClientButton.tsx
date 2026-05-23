'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface Props {
  clientId: string
  clientName: string
}

export function DeleteClientButton({ clientId, clientName }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    const confirmed = window.confirm(
      `¿Eliminar "${clientName}"?\n\nEl cliente y todos sus datos desaparecerán del panel. Los datos se conservan en la base de datos y se pueden restaurar.`
    )
    if (!confirmed) return

    setLoading(true)
    const res = await fetch(`/api/clients/${clientId}`, { method: 'DELETE' })
    if (res.ok) {
      router.push('/admin/clients')
    } else {
      const data = await res.json() as { error?: string }
      alert(data.error ?? 'Error al eliminar el cliente.')
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="rounded-md border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
    >
      {loading ? 'Eliminando…' : 'Eliminar'}
    </button>
  )
}
