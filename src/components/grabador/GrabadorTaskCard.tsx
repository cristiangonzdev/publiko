'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

interface RecordingBrief {
  concept?: string
  objective?: string
  planes?: string[]
  duracion_estimada?: string
  preparacion?: string[]
  musica_referencia?: string
  referencia_visual?: string
  notas_tecnicas?: string
  deadline?: string
}

interface Props {
  taskId: string
  title: string
  status: string
  deadline: string | null
  recordingBrief: RecordingBrief | null
  driveFolderId: string | null
}

export function GrabadorTaskCard({ taskId, title, status, deadline, recordingBrief, driveFolderId }: Props) {
  const [currentStatus, setCurrentStatus] = useState(status)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const markBrutosReady = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/tasks/${taskId}/brutos-ready`, { method: 'POST' })
      if (!res.ok) throw new Error(await res.text())
      setCurrentStatus('brutos_ready')
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  const daysLeft = deadline
    ? Math.floor((new Date(deadline).getTime() - Date.now()) / 86400000)
    : null

  return (
    <div className={cn(
      'rounded-lg border bg-white shadow-sm',
      currentStatus === 'brutos_ready' ? 'border-green-200' : 'border-ink-200'
    )}>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-ink-900">{title}</p>
            {recordingBrief?.concept && (
              <p className="mt-0.5 text-sm text-ink-500">{recordingBrief.concept}</p>
            )}
          </div>
          <div className="flex-shrink-0 text-right">
            <span className={cn(
              'inline-block rounded-full px-2.5 py-0.5 text-xs font-medium',
              currentStatus === 'brutos_ready' ? 'bg-green-50 text-green-700' :
              currentStatus === 'recording' ? 'bg-yellow-50 text-yellow-700' :
              'bg-ink-100 text-ink-500'
            )}>
              {currentStatus === 'brutos_ready' ? 'Brutos listos' :
               currentStatus === 'recording' ? 'Grabando' : currentStatus}
            </span>
            {daysLeft !== null && (
              <p className={cn('mt-1 text-[11px]',
                daysLeft < 0 ? 'text-red-600 font-semibold' :
                daysLeft <= 1 ? 'text-orange-500' : 'text-ink-400'
              )}>
                {daysLeft < 0 ? `${Math.abs(daysLeft)}d vencido` :
                 daysLeft === 0 ? 'Hoy' :
                 daysLeft === 1 ? 'Mañana' : `${daysLeft}d`}
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-brand hover:underline"
          >
            {expanded ? 'Ocultar ficha' : 'Ver ficha de grabación'}
          </button>

          {driveFolderId && (
            <a
              href={`https://drive.google.com/drive/folders/${driveFolderId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-ink-500 hover:text-ink-700 hover:underline"
            >
              Abrir Drive →
            </a>
          )}
        </div>

        {currentStatus !== 'brutos_ready' && (
          <button
            onClick={markBrutosReady}
            disabled={loading}
            className="mt-3 w-full rounded-md bg-ink-900 py-2 text-sm font-medium text-white hover:bg-ink-800 disabled:opacity-50"
          >
            {loading ? 'Guardando…' : '✓ Marcar brutos listos'}
          </button>
        )}

        {currentStatus === 'brutos_ready' && (
          <div className="mt-3 rounded-md bg-green-50 py-2 text-center text-sm font-medium text-green-700">
            ✓ Brutos enviados al editor
          </div>
        )}
      </div>

      {expanded && recordingBrief && (
        <div className="border-t border-ink-100 px-5 py-4 space-y-3 text-sm">
          {recordingBrief.objective && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Objetivo</p>
              <p className="mt-1 text-ink-700">{recordingBrief.objective}</p>
            </div>
          )}

          {recordingBrief.planes && recordingBrief.planes.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Planos a grabar</p>
              <ul className="mt-1 space-y-1">
                {recordingBrief.planes.map((p, i) => (
                  <li key={i} className="flex gap-2 text-ink-700">
                    <span className="text-brand font-medium">{i + 1}.</span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {recordingBrief.preparacion && recordingBrief.preparacion.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Preparación necesaria</p>
              <ul className="mt-1 space-y-0.5">
                {recordingBrief.preparacion.map((p, i) => (
                  <li key={i} className="flex gap-2 text-ink-700">
                    <span>·</span>{p}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {recordingBrief.duracion_estimada && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Duración estimada del bruto</p>
              <p className="mt-1 text-ink-700">{recordingBrief.duracion_estimada}</p>
            </div>
          )}

          {recordingBrief.musica_referencia && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Música de referencia</p>
              <p className="mt-1 text-ink-700">{recordingBrief.musica_referencia}</p>
            </div>
          )}

          {recordingBrief.notas_tecnicas && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Notas técnicas</p>
              <p className="mt-1 text-ink-700">{recordingBrief.notas_tecnicas}</p>
            </div>
          )}

          {recordingBrief.referencia_visual && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Referencia visual</p>
              <p className="mt-1 text-ink-700">{recordingBrief.referencia_visual}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
