'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

interface Task {
  id: string
  business_name: string
  title: string
  status: string
  content_type: string
  deadline: string | null
  grabador_id: string | null
  editor_id: string | null
  target_platforms: string[]
  publish_at: string | null
}

interface TeamMember { id: string; full_name: string }

interface Props {
  initialTasks: Task[]
  grabadores: TeamMember[]
  editores: TeamMember[]
}

const STATUS_COLOR: Record<string, string> = {
  approved_idea: 'bg-ink-100 text-ink-600',
  brief_sent: 'bg-blue-50 text-blue-700',
  recording: 'bg-yellow-50 text-yellow-700',
  brutos_ready: 'bg-purple-50 text-purple-700',
  editing: 'bg-orange-50 text-orange-700',
  delivered: 'bg-pink-50 text-pink-700',
  approved: 'bg-green-50 text-green-700',
  scheduled: 'bg-teal-50 text-teal-700',
}

export function TasksManager({ initialTasks, grabadores, editores }: Props) {
  const [tasks, setTasks] = useState(initialTasks)
  const [loading, setLoading] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [edits, setEdits] = useState<Record<string, Partial<Task>>>({})

  const save = async (taskId: string) => {
    const changes = edits[taskId]
    if (!changes) return
    setLoading(taskId)
    try {
      await fetch(`/api/tasks/${taskId}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      })
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, ...changes } : t))
      setEdits((prev) => { const n = { ...prev }; delete n[taskId]; return n })
      setExpanded(null)
    } finally {
      setLoading(null)
    }
  }

  const updateEdit = (taskId: string, field: keyof Task, value: unknown) => {
    setEdits((prev) => ({ ...prev, [taskId]: { ...(prev[taskId] ?? {}), [field]: value } }))
  }

  const PLATFORMS = ['instagram', 'facebook', 'tiktok', 'gmb']

  return (
    <div className="mt-6">
      <div className="overflow-hidden rounded-lg border border-ink-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-ink-200 bg-ink-50">
            <tr>
              {['Cliente · Tarea', 'Tipo', 'Estado', 'Grabador', 'Editor', 'Deadline', ''].map((h) => (
                <th key={h} className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-400">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {!tasks.length && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-ink-400">
                  Sin tareas activas.
                </td>
              </tr>
            )}
            {tasks.map((task) => {
              const isExpanded = expanded === task.id
              const edit = edits[task.id] ?? {}
              return (
                <>
                  <tr key={task.id} className={cn('hover:bg-ink-50', isExpanded && 'bg-ink-50')}>
                    <td className="px-3 py-3 max-w-[200px]">
                      <p className="text-[10px] font-medium text-brand">{task.business_name}</p>
                      <p className="font-medium text-ink-800 truncate">{task.title}</p>
                    </td>
                    <td className="px-3 py-3 text-[11px] text-ink-500">{task.content_type}</td>
                    <td className="px-3 py-3">
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', STATUS_COLOR[task.status] ?? 'bg-ink-100 text-ink-500')}>
                        {task.status}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <select
                        value={(edit.grabador_id ?? task.grabador_id) || ''}
                        onChange={(e) => updateEdit(task.id, 'grabador_id', e.target.value || null)}
                        className="w-full rounded border border-ink-200 bg-white px-2 py-1 text-xs focus:border-brand focus:outline-none"
                      >
                        <option value="">Sin asignar</option>
                        {grabadores.map((g) => <option key={g.id} value={g.id}>{g.full_name}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-3">
                      <select
                        value={(edit.editor_id ?? task.editor_id) || ''}
                        onChange={(e) => updateEdit(task.id, 'editor_id', e.target.value || null)}
                        className="w-full rounded border border-ink-200 bg-white px-2 py-1 text-xs focus:border-brand focus:outline-none"
                      >
                        <option value="">Sin asignar</option>
                        {editores.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-3">
                      <input
                        type="date"
                        value={(edit.deadline ?? task.deadline)?.slice(0, 10) ?? ''}
                        onChange={(e) => updateEdit(task.id, 'deadline', e.target.value || null)}
                        className="rounded border border-ink-200 px-2 py-1 text-xs focus:border-brand focus:outline-none"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex gap-1">
                        {edits[task.id] && (
                          <button
                            onClick={() => save(task.id)}
                            disabled={loading === task.id}
                            className="rounded bg-ink-900 px-2.5 py-1 text-[10px] font-medium text-white hover:bg-ink-700 disabled:opacity-50"
                          >
                            {loading === task.id ? '…' : 'Guardar'}
                          </button>
                        )}
                        <button
                          onClick={() => setExpanded(isExpanded ? null : task.id)}
                          className="rounded border border-ink-200 px-2 py-1 text-[10px] text-ink-500 hover:bg-ink-50"
                        >
                          {isExpanded ? '▲' : '▼'}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${task.id}-expand`} className="bg-ink-50">
                      <td colSpan={7} className="px-4 py-3">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs font-semibold text-ink-500 mb-1.5">Plataformas destino</p>
                            <div className="flex flex-wrap gap-1.5">
                              {PLATFORMS.map((p) => {
                                const platforms = (edit.target_platforms ?? task.target_platforms) as string[]
                                const isActive = platforms.includes(p)
                                return (
                                  <button
                                    key={p}
                                    onClick={() => {
                                      const current = (edit.target_platforms ?? task.target_platforms) as string[]
                                      updateEdit(task.id, 'target_platforms',
                                        isActive ? current.filter((x) => x !== p) : [...current, p]
                                      )
                                    }}
                                    className={cn(
                                      'rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                                      isActive ? 'bg-ink-900 text-white' : 'border border-ink-200 text-ink-500'
                                    )}
                                  >
                                    {p}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-ink-500 mb-1.5">Fecha de publicación</p>
                            <input
                              type="datetime-local"
                              value={(edit.publish_at ?? task.publish_at)?.slice(0, 16) ?? ''}
                              onChange={(e) => updateEdit(task.id, 'publish_at', e.target.value || null)}
                              className="rounded border border-ink-200 px-2 py-1.5 text-sm focus:border-brand focus:outline-none"
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
