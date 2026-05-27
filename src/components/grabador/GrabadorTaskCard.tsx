'use client'

import { useState, useRef } from 'react'
import { cn } from '@/lib/utils'
import { uploadViaSignedUrl } from '@/lib/upload/signed-upload'

interface RecordingBrief {
  concept?: string
  objective?: string
  planes?: string[]
  duracion_estimada?: string
  preparacion?: string[]
  musica_referencia?: string
  referencia_visual?: string
  notas_tecnicas?: string
}

interface Props {
  taskId: string
  title: string
  clientName: string
  status: string
  deadline: string | null
  recordingBrief: RecordingBrief | null
  driveFolderId: string | null
}

export function GrabadorTaskCard({ taskId, title, clientName, status, deadline, recordingBrief }: Props) {
  const [currentStatus, setCurrentStatus] = useState(status)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(true)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setUploadProgress(`Subiendo ${file.name}…`)

    try {
      await uploadViaSignedUrl({
        prepareEndpoint: `/api/tasks/${taskId}/bruto-prepare`,
        confirmEndpoint: `/api/tasks/${taskId}/bruto-confirm`,
        file,
      })
      setCurrentStatus('brutos_ready')
      setUploadProgress(null)
    } catch (err) {
      alert(`Error subiendo: ${err instanceof Error ? err.message : String(err)}`)
      setUploadProgress(null)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
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
      <input
        ref={fileRef}
        type="file"
        accept="video/*,image/*"
        className="hidden"
        onChange={handleFileSelect}
      />

      <div className="p-4 md:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {clientName && (
              <p className="text-xs font-semibold uppercase tracking-wider text-brand mb-0.5">{clientName}</p>
            )}
            <p className="font-medium text-base text-ink-900">{title}</p>
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
               currentStatus === 'recording' ? 'Grabando' : 'Pendiente'}
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

        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-4 min-h-[36px] text-xs text-ink-400 hover:text-ink-700"
        >
          {expanded ? '▲ Ocultar ficha técnica' : '▼ Ver ficha técnica'}
        </button>

        {currentStatus !== 'brutos_ready' && (
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="mt-3 w-full rounded-md bg-ink-900 py-3 text-sm font-medium text-white hover:bg-ink-800 disabled:opacity-50"
          >
            {uploading ? (uploadProgress ?? 'Subiendo…') : '↑ Subir brutos y avisar al editor'}
          </button>
        )}

        {currentStatus === 'brutos_ready' && (
          <div className="mt-3 space-y-2">
            <div className="rounded-md bg-green-50 py-2 text-center text-sm font-medium text-green-700">
              ✓ Brutos enviados al editor
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-full rounded-md border border-ink-200 py-1.5 text-xs text-ink-500 hover:bg-ink-50 disabled:opacity-50"
            >
              {uploading ? 'Subiendo…' : '+ Añadir otro archivo'}
            </button>
          </div>
        )}
      </div>

      {expanded && recordingBrief && (
        <div className="border-t border-ink-100 px-4 py-4 md:px-5 space-y-3 text-sm">
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
                  <li key={i} className="flex gap-2 text-ink-700"><span>·</span>{p}</li>
                ))}
              </ul>
            </div>
          )}

          {recordingBrief.duracion_estimada && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Duración del bruto</p>
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
