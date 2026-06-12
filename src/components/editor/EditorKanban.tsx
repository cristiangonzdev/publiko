'use client'

import { useState, useRef } from 'react'
import { cn } from '@/lib/utils'
import { uploadViaSignedUrl } from '@/lib/upload/signed-upload'
import { detectAspectRatio } from '@/lib/upload/aspect-ratio'
import { BrollsPanel } from './BrollsPanel'
import { BrandVoicePanel } from '@/components/ui/BrandVoicePanel'
import { CONTENT_STATUS } from '@/lib/status'

const COLS = [
  { key: 'brutos_ready', label: CONTENT_STATUS.brutos_ready.label },
  { key: 'editing', label: CONTENT_STATUS.editing.label },
  { key: 'delivered', label: CONTENT_STATUS.delivered.label },
  { key: 'approved', label: CONTENT_STATUS.approved.label },
  { key: 'published', label: CONTENT_STATUS.published.label },
] as const

const DEADLINE_COLOR = (deadline: string | null) => {
  if (!deadline) return 'text-ink-400'
  const days = Math.floor((new Date(deadline).getTime() - Date.now()) / 86400000)
  if (days < 0) return 'text-red-600 font-semibold'
  if (days <= 1) return 'text-orange-500 font-semibold'
  if (days <= 3) return 'text-yellow-600'
  return 'text-ink-400'
}

interface Bruto {
  id: string
  file_name: string
  signed_url: string | null
  file_size: number | null
}

interface Task {
  id: string
  title: string
  client_id: string
  client_name?: string
  status: string
  deadline: string | null
  content_type?: string | null
  copy_selected: string | null
  editing_brief: Record<string, unknown> | null
  final_asset_id: string | null
}

interface Props {
  initialTasks: Task[]
}

function formatBytes(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function EditorKanban({ initialTasks }: Props) {
  const [tasks, setTasks] = useState(initialTasks)
  const [uploading, setUploading] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [brutos, setBrutos] = useState<Record<string, Bruto[]>>({})
  const [loadingBrutos, setLoadingBrutos] = useState<string | null>(null)
  const [brollsClient, setBrollsClient]       = useState<{ id: string; name: string } | null>(null)
  const [brandVoiceClient, setBrandVoiceClient] = useState<{ id: string; name: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const uploadingTask = useRef<string | null>(null)

  const moveStatus = async (taskId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: `Error ${res.status}` }))
        alert(error ?? 'No se pudo cambiar el estado')
        return
      }
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: newStatus } : t))
    } catch {
      alert('Sin conexión: no se pudo cambiar el estado')
    }
  }

  const loadBrutos = async (taskId: string) => {
    if (brutos[taskId]) return
    setLoadingBrutos(taskId)
    try {
      const res = await fetch(`/api/tasks/${taskId}/brutos-urls`)
      if (res.ok) {
        const { brutos: files } = await res.json() as { brutos: Bruto[] }
        setBrutos((prev) => ({ ...prev, [taskId]: files }))
      }
    } finally {
      setLoadingBrutos(null)
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const taskId = uploadingTask.current
    if (!file || !taskId) return

    const task = tasks.find((t) => t.id === taskId)
    if (task?.content_type === 'story') {
      const info = await detectAspectRatio(file)
      if (info && !info.isPortrait916) {
        const proceed = window.confirm(
          `⚠️ Esta tarea es una STORY pero el archivo es ${info.label}.\n` +
          `Las stories de IG/FB requieren formato vertical 9:16 — el contenido se recortará o aparecerá con bandas.\n\n` +
          `¿Subir igualmente?`
        )
        if (!proceed) {
          uploadingTask.current = null
          if (fileRef.current) fileRef.current.value = ''
          return
        }
      }
    }

    setUploading(taskId)
    try {
      await uploadViaSignedUrl({
        prepareEndpoint: `/api/tasks/${taskId}/deliverable-prepare`,
        confirmEndpoint: `/api/tasks/${taskId}/deliverable-confirm`,
        file,
      })
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: 'delivered' } : t))
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setUploading(null)
      uploadingTask.current = null
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const startUpload = (taskId: string) => {
    uploadingTask.current = taskId
    fileRef.current?.click()
  }

  const toggleExpand = async (taskId: string) => {
    const next = expanded === taskId ? null : taskId
    setExpanded(next)
    if (next) await loadBrutos(taskId)
  }

  return (
    <div className="mt-6">
      <input ref={fileRef} type="file" accept="video/*,image/*" className="hidden" onChange={handleFileSelect} />

      {brollsClient && (
        <BrollsPanel
          clientId={brollsClient.id}
          clientName={brollsClient.name}
          onClose={() => setBrollsClient(null)}
        />
      )}

      {brandVoiceClient && (
        <BrandVoicePanel
          clientId={brandVoiceClient.id}
          clientName={brandVoiceClient.name}
          onClose={() => setBrandVoiceClient(null)}
        />
      )}

      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLS.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.key)
          return (
            <div key={col.key} className="min-w-[280px] flex-shrink-0">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-ink-500">{col.label}</span>
                {colTasks.length > 0 && (
                  <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] text-ink-500">{colTasks.length}</span>
                )}
              </div>

              <div className="space-y-3">
                {colTasks.length === 0 && (
                  <div className="rounded-lg border border-dashed border-ink-200 py-6 text-center text-xs text-ink-300">
                    Sin tareas
                  </div>
                )}

                {colTasks.map((task) => {
                  const brief = task.editing_brief as Record<string, string> | null
                  const isExpanded = expanded === task.id
                  const taskBrutos = brutos[task.id] ?? []

                  return (
                    <div key={task.id} className="rounded-lg border border-ink-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-ink-900 leading-snug">{task.title}</p>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => setBrandVoiceClient({ id: task.client_id, name: task.client_name ?? '' })}
                            className="flex items-center gap-1 text-[10px] text-violet-500 hover:text-violet-700"
                            title="Ver brand voice del cliente"
                          >
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                            </svg>
                            voz
                          </button>
                          <button
                            onClick={() => setBrollsClient({ id: task.client_id, name: task.client_name ?? '' })}
                            className="flex items-center gap-1 text-[10px] text-ink-400 hover:text-brand"
                            title="Ver b-rolls del cliente"
                          >
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
                            </svg>
                            b-rolls
                          </button>
                          <button
                            onClick={() => toggleExpand(task.id)}
                            className="text-[10px] text-ink-400 hover:text-ink-600"
                          >
                            {isExpanded ? 'cerrar' : 'brief + archivos'}
                          </button>
                        </div>
                      </div>

                      {task.deadline && (
                        <p className={cn('mt-1 text-[10px]', DEADLINE_COLOR(task.deadline))}>
                          {new Date(task.deadline).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </p>
                      )}

                      {isExpanded && (
                        <div className="mt-3 space-y-3">
                          {/* Brutos para descargar */}
                          {(col.key === 'brutos_ready' || col.key === 'editing') && (
                            <div className="rounded bg-ink-50 p-3">
                              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                                Archivos del grabador
                              </p>
                              {loadingBrutos === task.id && (
                                <p className="text-xs text-ink-400">Cargando…</p>
                              )}
                              {taskBrutos.length === 0 && loadingBrutos !== task.id && (
                                <p className="text-xs text-ink-400">Sin archivos subidos todavía.</p>
                              )}
                              {taskBrutos.map((b) => (
                                <a
                                  key={b.id}
                                  href={b.signed_url ?? '#'}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center justify-between gap-2 py-1 text-xs text-brand hover:underline"
                                >
                                  <span className="truncate">{b.file_name}</span>
                                  <span className="flex-shrink-0 text-ink-400">{formatBytes(b.file_size)}</span>
                                </a>
                              ))}
                            </div>
                          )}

                          {/* Brief de edición */}
                          {brief && (
                            <div className="rounded bg-ink-50 p-3 text-[11px] text-ink-600 space-y-1.5">
                              {brief.duracion_final && <p><span className="font-semibold">Duración:</span> {brief.duracion_final}</p>}
                              {brief.ritmo && <p><span className="font-semibold">Ritmo:</span> {brief.ritmo}</p>}
                              {brief.transiciones && <p><span className="font-semibold">Transiciones:</span> {brief.transiciones}</p>}
                              {brief.musica_exacta && <p><span className="font-semibold">Música:</span> {brief.musica_exacta}</p>}
                              {brief.color_grade && <p><span className="font-semibold">Color:</span> {brief.color_grade}</p>}
                              {brief.formato_exportacion && <p><span className="font-semibold">Exportar:</span> {brief.formato_exportacion}</p>}
                              {brief.notas_especiales && <p className="mt-1 italic text-ink-500">{brief.notas_especiales}</p>}
                            </div>
                          )}

                          {/* Copy seleccionado */}
                          {task.copy_selected && (
                            <div className="rounded bg-blue-50 p-3 text-[11px] text-blue-800">
                              <p className="font-semibold mb-1">Copy final:</p>
                              <p className="whitespace-pre-wrap">{task.copy_selected}</p>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="mt-3 flex gap-2">
                        {col.key === 'brutos_ready' && (
                          <button
                            onClick={() => moveStatus(task.id, 'editing')}
                            className="flex-1 rounded bg-yellow-500 py-1.5 text-xs font-medium text-white hover:bg-yellow-600"
                          >
                            Iniciar edición
                          </button>
                        )}
                        {col.key === 'editing' && (
                          <button
                            onClick={() => startUpload(task.id)}
                            disabled={uploading === task.id}
                            className="flex-1 rounded bg-ink-900 py-1.5 text-xs font-medium text-white hover:bg-ink-800 disabled:opacity-50"
                          >
                            {uploading === task.id ? 'Subiendo…' : '↑ Subir entregable'}
                          </button>
                        )}
                        {(col.key === 'delivered' || col.key === 'approved') && (
                          <span className="text-[10px] text-ink-400">Esperando revisión del admin</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
