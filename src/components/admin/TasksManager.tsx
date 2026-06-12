'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { contentStatusStyle } from '@/lib/status'

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

function WorkloadCard({ name, tasks, role }: { name: string; tasks: Task[]; role: 'grabador' | 'editor' }) {
  const active  = tasks.filter((t) => !['delivered', 'approved', 'published'].includes(t.status)).length
  const overdue = tasks.filter((t) => {
    if (!t.deadline) return false
    return new Date(t.deadline) < new Date() && !['delivered', 'approved', 'published'].includes(t.status)
  }).length
  const urgent  = tasks.filter((t) => {
    if (!t.deadline) return false
    const days = Math.floor((new Date(t.deadline).getTime() - Date.now()) / 86400000)
    return days >= 0 && days <= 1 && !['delivered', 'approved', 'published'].includes(t.status)
  }).length

  const health = overdue > 0 ? 'critical' : urgent > 0 ? 'warning' : active > 5 ? 'busy' : 'ok'

  return (
    <div className={cn(
      'rounded-xl border p-4',
      health === 'critical' ? 'border-red-200 bg-red-50'      :
      health === 'warning'  ? 'border-amber-200 bg-amber-50'  :
      health === 'busy'     ? 'border-blue-200 bg-blue-50'    :
      'border-green-200 bg-green-50'
    )}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-ink-700 truncate max-w-[120px]">{name}</p>
          <p className={cn(
            'text-[10px] font-medium uppercase tracking-wide mt-0.5',
            health === 'critical' ? 'text-red-500'    :
            health === 'warning'  ? 'text-amber-600'  :
            health === 'busy'     ? 'text-blue-600'   :
            'text-green-600'
          )}>
            {role === 'grabador' ? 'Grabador' : 'Editor'}
          </p>
        </div>
        <span className={cn(
          'rounded-lg px-2 py-1 text-base font-bold',
          health === 'critical' ? 'bg-red-100 text-red-700'       :
          health === 'warning'  ? 'bg-amber-100 text-amber-700'   :
          health === 'busy'     ? 'bg-blue-100 text-blue-700'     :
          'bg-green-100 text-green-700'
        )}>
          {active}
        </span>
      </div>
      <div className="mt-2 flex gap-2 text-[10px]">
        {overdue > 0 && <span className="rounded bg-red-100 px-1.5 py-0.5 font-medium text-red-600">{overdue} vencida{overdue > 1 ? 's' : ''}</span>}
        {urgent  > 0 && <span className="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-700">{urgent} urgente{urgent > 1 ? 's' : ''}</span>}
        {overdue === 0 && urgent === 0 && active === 0 && <span className="text-green-600">Sin carga</span>}
        {overdue === 0 && urgent === 0 && active > 0  && <span className="text-ink-400">{active} activa{active > 1 ? 's' : ''}</span>}
      </div>
    </div>
  )
}

const STATUS_FILTERS: { key: string; label: string; statuses: string[] | null }[] = [
  { key: 'all', label: 'Todas', statuses: null },
  { key: 'pre', label: 'Por arrancar', statuses: ['idea', 'suggested', 'approved_idea', 'brief_sent'] },
  { key: 'recording', label: 'Grabación', statuses: ['recording', 'brutos_ready'] },
  { key: 'editing', label: 'Edición', statuses: ['editing', 'revision'] },
  { key: 'review', label: 'Por aprobar', statuses: ['delivered'] },
  { key: 'publish', label: 'Publicación', statuses: ['approved', 'scheduled', 'failed'] },
]

export function TasksManager({ initialTasks, grabadores, editores }: Props) {
  const [tasks, setTasks] = useState(initialTasks)
  const [loading, setLoading] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [edits, setEdits] = useState<Record<string, Partial<Task>>>({})
  const [statusFilter, setStatusFilter] = useState('all')

  const activeFilter = STATUS_FILTERS.find((f) => f.key === statusFilter) ?? STATUS_FILTERS[0]
  const visibleTasks = activeFilter.statuses
    ? tasks.filter((t) => activeFilter.statuses!.includes(t.status))
    : tasks

  const save = async (taskId: string) => {
    const changes = edits[taskId]
    if (!changes) return
    setLoading(taskId)
    try {
      const res = await fetch(`/api/tasks/${taskId}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: `Error ${res.status}` }))
        alert(error ?? 'No se pudo guardar la asignación')
        return // conserva los edits para reintentar
      }
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, ...changes } : t))
      setEdits((prev) => { const n = { ...prev }; delete n[taskId]; return n })
      setExpanded(null)
    } catch {
      alert('Sin conexión: no se pudo guardar')
    } finally {
      setLoading(null)
    }
  }

  const updateEdit = (taskId: string, field: keyof Task, value: unknown) => {
    setEdits((prev) => ({ ...prev, [taskId]: { ...(prev[taskId] ?? {}), [field]: value } }))
  }

  const PLATFORMS = ['instagram', 'facebook', 'tiktok', 'gmb']

  const teamHasMembers = grabadores.length + editores.length > 0

  return (
    <div className="mt-6 space-y-6">

      {/* Carga del equipo */}
      {teamHasMembers && (
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-400">Carga del equipo</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {grabadores.map((g) => (
              <WorkloadCard
                key={g.id}
                name={g.full_name ?? 'Grabador'}
                role="grabador"
                tasks={tasks.filter((t) => t.grabador_id === g.id)}
              />
            ))}
            {editores.map((e) => (
              <WorkloadCard
                key={e.id}
                name={e.full_name ?? 'Editor'}
                role="editor"
                tasks={tasks.filter((t) => t.editor_id === e.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Filtro por fase del pipeline */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => {
          const count = f.statuses ? tasks.filter((t) => f.statuses!.includes(t.status)).length : tasks.length
          return (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                statusFilter === f.key
                  ? 'bg-ink-900 text-white'
                  : 'border border-ink-200 text-ink-500 hover:border-ink-400'
              )}
            >
              {f.label} <span className={statusFilter === f.key ? 'text-ink-300' : 'text-ink-400'}>{count}</span>
            </button>
          )
        })}
      </div>

      <div className="overflow-x-auto rounded-lg border border-ink-200 bg-white">
        <table className="min-w-[750px] w-full text-sm">
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
            {!visibleTasks.length && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-ink-400">
                  {statusFilter === 'all' ? 'Sin tareas activas.' : 'Sin tareas en esta fase.'}
                </td>
              </tr>
            )}
            {visibleTasks.map((task) => {
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
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', contentStatusStyle(task.status).badge)}>
                        {contentStatusStyle(task.status).label}
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
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
