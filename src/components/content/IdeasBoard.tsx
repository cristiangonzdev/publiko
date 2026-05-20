'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

const STATUS_COLS = ['suggested', 'approved', 'in_production', 'published', 'discarded'] as const
const STATUS_LABEL: Record<string, string> = {
  suggested: 'Sugeridas',
  approved: 'Aprobadas',
  in_production: 'En producción',
  published: 'Publicadas',
  discarded: 'Descartadas',
}
const STATUS_COLOR: Record<string, string> = {
  suggested: 'bg-ink-100 text-ink-600',
  approved: 'bg-blue-50 text-blue-700',
  in_production: 'bg-yellow-50 text-yellow-700',
  published: 'bg-green-50 text-green-700',
  discarded: 'bg-ink-50 text-ink-400',
}
const ORIGIN_BADGE: Record<string, string> = {
  system: 'IA',
  human: 'Humano',
}

interface Props {
  clientId: string
  initialIdeas: Array<Record<string, unknown>>
  brandBrainCompleted: boolean
}

export function IdeasBoard({ clientId, initialIdeas, brandBrainCompleted }: Props) {
  const [ideas, setIdeas] = useState(initialIdeas)
  const [generating, setGenerating] = useState(false)
  const [activeStatus, setActiveStatus] = useState<string>('suggested')

  const generate = async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/ideas/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId }),
      })
      if (!res.ok) throw new Error(await res.text())
      const { ideas: newIdeas } = await res.json() as { ideas: Array<Record<string, unknown>> }
      setIdeas((prev) => [...newIdeas, ...prev])
    } catch (err) {
      alert(`Error generando ideas: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setGenerating(false)
    }
  }

  const approve = async (ideaId: string) => {
    await fetch(`/api/ideas/${ideaId}/approve`, { method: 'POST' })
    setIdeas((prev) => prev.map((i) => i.id === ideaId ? { ...i, status: 'approved' } : i))
  }

  const discard = async (ideaId: string) => {
    await fetch(`/api/ideas/${ideaId}/discard`, { method: 'POST' })
    setIdeas((prev) => prev.map((i) => i.id === ideaId ? { ...i, status: 'discarded' } : i))
  }

  const filtered = ideas.filter((i) => i.status === activeStatus)

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Status tabs */}
        <div className="flex gap-1.5">
          {STATUS_COLS.map((s) => {
            const count = ideas.filter((i) => i.status === s).length
            return (
              <button
                key={s}
                onClick={() => setActiveStatus(s)}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                  activeStatus === s ? 'bg-ink-900 text-white' : 'border border-ink-200 text-ink-500 hover:border-ink-400'
                )}
              >
                {STATUS_LABEL[s]} {count > 0 && <span className="ml-1 opacity-70">{count}</span>}
              </button>
            )
          })}
        </div>

        <button
          onClick={generate}
          disabled={generating || !brandBrainCompleted}
          title={!brandBrainCompleted ? 'Completa el Brand Brain antes de generar ideas' : undefined}
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
        >
          {generating ? 'Generando…' : '✦ Generar plan semanal'}
        </button>
      </div>

      {!brandBrainCompleted && (
        <div className="mt-4 rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          Completa el <a href="../brand-brain" className="underline">Brand Brain</a> para poder generar ideas.
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.length === 0 && (
          <p className="col-span-3 py-8 text-center text-sm text-ink-400">
            {activeStatus === 'suggested' ? 'Sin ideas sugeridas. Genera el plan semanal.' : `Sin ideas en "${STATUS_LABEL[activeStatus]}".`}
          </p>
        )}
        {filtered.map((idea) => (
          <div key={idea.id as string} className="rounded-lg border border-ink-200 bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', STATUS_COLOR[idea.status as string])}>
                {idea.content_type as string}
              </span>
              <span className="text-[10px] text-ink-400">
                {ORIGIN_BADGE[idea.content_origin as string] ?? ''}
              </span>
            </div>

            <p className="mt-2 text-sm font-medium text-ink-900">{idea.concept as string}</p>
            {Boolean(idea.full_description) && (
              <p className="mt-1 text-xs text-ink-500 line-clamp-3">{idea.full_description as string}</p>
            )}
            {Boolean(idea.angle) && (
              <p className="mt-2 text-[10px] text-ink-400">Ángulo: {idea.angle as string}</p>
            )}

            {activeStatus === 'suggested' && (
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => approve(idea.id as string)}
                  className="flex-1 rounded bg-ink-900 py-1.5 text-xs font-medium text-white hover:bg-ink-800"
                >
                  Aprobar
                </button>
                <button
                  onClick={() => discard(idea.id as string)}
                  className="rounded border border-ink-200 px-3 py-1.5 text-xs text-ink-500 hover:bg-ink-50"
                >
                  Descartar
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
