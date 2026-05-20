'use client'

import { useState, useRef } from 'react'
import { cn } from '@/lib/utils'

const COLS = [
  { key: 'brutos_ready', label: 'Brutos listos' },
  { key: 'editing', label: 'En edición' },
  { key: 'delivered', label: 'Entregado' },
  { key: 'approved', label: 'Aprobado' },
  { key: 'published', label: 'Publicado' },
] as const

const DEADLINE_COLOR = (deadline: string | null) => {
  if (!deadline) return 'text-ink-400'
  const days = Math.floor((new Date(deadline).getTime() - Date.now()) / 86400000)
  if (days < 0) return 'text-red-600 font-semibold'
  if (days <= 1) return 'text-orange-500 font-semibold'
  if (days <= 3) return 'text-yellow-600'
  return 'text-ink-400'
}

interface Task {
  id: string
  title: string
  client_id: string
  status: string
  deadline: string | null
  copy_selected: string | null
  editing_brief: Record<string, unknown> | null
  final_asset_id: string | null
}

interface Props {
  initialTasks: Task[]
}

export function EditorKanban({ initialTasks }: Props) {
  const [tasks, setTasks] = useState(initialTasks)
  const [uploading, setUploading] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const uploadingTask = useRef<string | null>(null)

  const moveStatus = async (taskId: string, newStatus: string) => {
    await fetch(`/api/tasks/${taskId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: newStatus } : t))
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const taskId = uploadingTask.current
    if (!file || !taskId) return

    setUploading(taskId)
    const form = new FormData()
    form.append('file', file)
    form.append('task_id', taskId)

    try {
      const res = await fetch('/api/upload/deliverable', { method: 'POST', body: form })
      if (!res.ok) throw new Error(await res.text())
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

  return (
    <div className="mt-6">
      <input ref={fileRef} type="file" accept="video/*,image/*" className="hidden" onChange={handleFileSelect} />

      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLS.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.key)
          return (
            <div key={col.key} className="min-w-[260px] flex-shrink-0">
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
                  return (
                    <div key={task.id} className="rounded-lg border border-ink-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-ink-900 leading-snug">{task.title}</p>
                        <button
                          onClick={() => setExpanded(isExpanded ? null : task.id)}
                          className="text-[10px] text-ink-400 hover:text-ink-600 flex-shrink-0"
                        >
                          {isExpanded ? 'cerrar' : 'brief'}
                        </button>
                      </div>

                      {task.deadline && (
                        <p className={cn('mt-1 text-[10px]', DEADLINE_COLOR(task.deadline))}>
                          {new Date(task.deadline).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </p>
                      )}

                      {isExpanded && brief && (
                        <div className="mt-3 space-y-1.5 rounded bg-ink-50 p-3 text-[11px] text-ink-600">
                          {brief.duracion_final && <p><span className="font-semibold">Duración:</span> {brief.duracion_final}</p>}
                          {brief.ritmo && <p><span className="font-semibold">Ritmo:</span> {brief.ritmo}</p>}
                          {brief.transiciones && <p><span className="font-semibold">Transiciones:</span> {brief.transiciones}</p>}
                          {brief.musica_exacta && <p><span className="font-semibold">Música:</span> {brief.musica_exacta}</p>}
                          {brief.color_grade && <p><span className="font-semibold">Color:</span> {brief.color_grade}</p>}
                          {brief.formato_exportacion && <p><span className="font-semibold">Exportar:</span> {brief.formato_exportacion}</p>}
                          {brief.notas_especiales && <p className="mt-1 text-ink-500 italic">{brief.notas_especiales}</p>}
                        </div>
                      )}

                      {isExpanded && task.copy_selected && (
                        <div className="mt-2 rounded bg-blue-50 p-3 text-[11px] text-blue-800">
                          <p className="font-semibold mb-1">Copy final:</p>
                          <p className="whitespace-pre-wrap">{task.copy_selected}</p>
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
