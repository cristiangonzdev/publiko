'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface BrainRevision {
  id: string
  section: string
  proposed_changes: Record<string, unknown>
  reasoning: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}

export default function RevisionsPage() {
  const params = useParams<{ id: string }>()
  const clientId = params.id
  const [revisions, setRevisions] = useState<BrainRevision[]>([])
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  useEffect(() => {
    async function load() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('brand_brain_revisions')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(20)
      setRevisions((data ?? []) as BrainRevision[])
      setLoading(false)
    }
    void load()
  }, [clientId, supabase])

  async function handleApprove(revisionId: string) {
    await fetch(`/api/brain-revisions/${revisionId}/approve`, { method: 'POST' })
    setRevisions((prev) => prev.map((r) => r.id === revisionId ? { ...r, status: 'approved' } : r))
  }

  async function handleReject(revisionId: string) {
    await fetch(`/api/brain-revisions/${revisionId}/reject`, { method: 'POST' })
    setRevisions((prev) => prev.map((r) => r.id === revisionId ? { ...r, status: 'rejected' } : r))
  }

  if (loading) return <div className="p-6 text-sm text-gray-500">Cargando revisiones…</div>

  const pending = revisions.filter((r) => r.status === 'pending')
  const reviewed = revisions.filter((r) => r.status !== 'pending')

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      <h1 className="text-xl font-semibold">Propuestas de refinamiento del Brand Brain</h1>

      {pending.length === 0 && (
        <p className="text-sm text-gray-500">No hay propuestas pendientes.</p>
      )}

      {pending.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500">Pendientes</h2>
          {pending.map((r) => (
            <div key={r.id} className="border rounded-lg p-4 space-y-3 bg-white shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                  Sección: {r.section}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(r.created_at).toLocaleDateString('es-ES')}
                </span>
              </div>
              <p className="text-sm text-gray-700">{r.reasoning}</p>
              <details className="text-xs">
                <summary className="cursor-pointer text-gray-500 hover:text-gray-700">Ver cambios propuestos</summary>
                <pre className="mt-2 p-2 bg-gray-50 rounded overflow-auto text-xs">
                  {JSON.stringify(r.proposed_changes, null, 2)}
                </pre>
              </details>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => handleApprove(r.id)}
                  className="text-xs px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Aprobar y aplicar
                </button>
                <button
                  onClick={() => handleReject(r.id)}
                  className="text-xs px-3 py-1.5 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                >
                  Rechazar
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {reviewed.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500">Historial</h2>
          {reviewed.map((r) => (
            <div key={r.id} className="border rounded-lg p-3 flex items-start gap-3 bg-gray-50">
              <span className={`text-xs px-2 py-0.5 rounded mt-0.5 ${r.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                {r.status === 'approved' ? 'Aplicado' : 'Rechazado'}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-600">{r.section}</p>
                <p className="text-xs text-gray-500 truncate">{r.reasoning.slice(0, 100)}…</p>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
