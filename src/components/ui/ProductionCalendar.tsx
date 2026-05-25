'use client'

import { cn } from '@/lib/utils'

interface CalTask {
  id:          string
  title:       string
  status:      string
  deadline:    string
  content_type: string
  client_name: string
}

interface Props {
  tasks: CalTask[]
  role:  'editor' | 'grabador'
}

const STATUS_LABEL: Record<string, string> = {
  approved_idea:  'Pendiente',
  brief_sent:     'Brief enviado',
  recording:      'Grabando',
  brutos_ready:   'Brutos listos',
  editing:        'En edición',
  delivered:      'Entregado',
  approved:       'Aprobado',
  revision:       'En revisión',
}

const STATUS_COLOR: Record<string, string> = {
  approved_idea:  'bg-ink-100 text-ink-600',
  brief_sent:     'bg-blue-100 text-blue-700',
  recording:      'bg-yellow-100 text-yellow-700',
  brutos_ready:   'bg-green-100 text-green-700',
  editing:        'bg-violet-100 text-violet-700',
  delivered:      'bg-teal-100 text-teal-700',
  approved:       'bg-green-100 text-green-700',
  revision:       'bg-orange-100 text-orange-700',
}

const TYPE_BADGE: Record<string, string> = {
  reel:     'Reel',
  post:     'Post',
  story:    'Story',
  carrusel: 'Carrusel',
}

function startOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function isSameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString()
}

function deadlineClass(deadline: string): string {
  const days = Math.floor((new Date(deadline).getTime() - Date.now()) / 86400000)
  if (days < 0)  return 'border-l-4 border-l-red-400'
  if (days <= 1) return 'border-l-4 border-l-orange-400'
  if (days <= 3) return 'border-l-4 border-l-yellow-400'
  return 'border-l-4 border-l-ink-200'
}

function DeadlineDot({ deadline }: { deadline: string }) {
  const days = Math.floor((new Date(deadline).getTime() - Date.now()) / 86400000)
  return (
    <span className={cn(
      'inline-block h-2 w-2 rounded-full flex-shrink-0',
      days < 0  ? 'bg-red-500'    :
      days <= 1 ? 'bg-orange-400' :
      days <= 3 ? 'bg-yellow-400' :
      'bg-green-400'
    )} />
  )
}

export function ProductionCalendar({ tasks, role }: Props) {
  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-ink-200 py-20 text-center">
        <svg className="mb-4 h-12 w-12 text-ink-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <p className="text-base font-semibold text-ink-700">Sin deadlines próximos</p>
        <p className="mt-1 text-sm text-ink-400">
          {role === 'editor'
            ? 'No tienes tareas con fecha límite asignadas.'
            : 'No tienes grabaciones con fecha límite asignadas.'}
        </p>
      </div>
    )
  }

  // Construir semanas desde hoy hasta la última deadline
  const today    = new Date()
  today.setHours(0, 0, 0, 0)
  const lastDate = new Date(Math.max(...tasks.map((t) => new Date(t.deadline).getTime())))
  const weeks: Date[][] = []

  let weekStart = startOfWeek(today)
  while (weekStart <= lastDate) {
    const week: Date[] = []
    for (let d = 0; d < 7; d++) week.push(addDays(weekStart, d))
    weeks.push(week)
    weekStart = addDays(weekStart, 7)
  }

  const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

  // Vista lista para móvil / simplicidad
  return (
    <div className="space-y-8">
      {/* Leyenda */}
      <div className="flex flex-wrap gap-3 text-[11px]">
        {[
          { color: 'bg-red-400',    label: 'Vencida' },
          { color: 'bg-orange-400', label: 'Hoy / Mañana' },
          { color: 'bg-yellow-400', label: 'Esta semana' },
          { color: 'bg-green-400',  label: 'Con margen' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5 text-ink-500">
            <span className={cn('h-2.5 w-2.5 rounded-full', color)} />
            {label}
          </div>
        ))}
      </div>

      {/* Vista por semana */}
      {weeks.map((week, wi) => {
        const weekTasks = tasks.filter((t) =>
          week.some((d) => isSameDay(d, new Date(t.deadline)))
        )
        if (weekTasks.length === 0 && wi > 0) return null

        const weekLabel = `${week[0].toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} — ${week[6].toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`

        return (
          <div key={wi}>
            <div className="mb-3 flex items-center gap-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-ink-400">{weekLabel}</p>
              {weekTasks.length > 0 && (
                <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-medium text-ink-500">
                  {weekTasks.length} deadline{weekTasks.length > 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* Grid días — scroll horizontal en móvil */}
            <div className="overflow-x-auto">
            <div className="grid grid-cols-7 gap-2 min-w-[560px]">
              {week.map((day, di) => {
                const dayTasks = tasks.filter((t) => isSameDay(new Date(t.deadline), day))
                const isToday  = isSameDay(day, today)
                const isPast   = day < today && !isToday

                return (
                  <div
                    key={di}
                    className={cn(
                      'min-h-[80px] rounded-xl border p-2',
                      isToday   ? 'border-brand bg-brand/5'   :
                      isPast    ? 'border-ink-100 bg-ink-50/50' :
                      'border-ink-200 bg-white'
                    )}
                  >
                    <p className={cn(
                      'mb-1.5 text-[11px] font-semibold',
                      isToday   ? 'text-brand'    :
                      isPast    ? 'text-ink-300'  :
                      'text-ink-500'
                    )}>
                      {DAYS[di]} {day.getDate()}
                    </p>
                    <div className="space-y-1">
                      {dayTasks.map((t) => (
                        <div
                          key={t.id}
                          className={cn(
                            'rounded-md bg-white px-1.5 py-1 shadow-sm',
                            deadlineClass(t.deadline)
                          )}
                        >
                          <div className="flex items-center gap-1 mb-0.5">
                            <DeadlineDot deadline={t.deadline} />
                            <span className="text-[9px] font-semibold text-brand truncate">{t.client_name}</span>
                          </div>
                          <p className="text-[10px] font-medium text-ink-800 leading-tight line-clamp-2">{t.title}</p>
                          <div className="mt-1 flex gap-1 flex-wrap">
                            <span className="text-[8px] font-medium text-ink-400 uppercase tracking-wide">
                              {TYPE_BADGE[t.content_type] ?? t.content_type}
                            </span>
                            <span className={cn(
                              'rounded px-1 text-[8px] font-medium',
                              STATUS_COLOR[t.status] ?? 'bg-ink-100 text-ink-500'
                            )}>
                              {STATUS_LABEL[t.status] ?? t.status}
                            </span>
                          </div>
                        </div>
                      ))}
                      {dayTasks.length === 0 && (
                        <p className="text-[10px] text-ink-200">—</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            </div>
          </div>
        )
      })}

      {/* Lista completa */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-400">Todas las tareas por deadline</p>
        <div className="divide-y divide-ink-100 rounded-xl border border-ink-200 bg-white">
          {tasks.map((t) => {
            const days = Math.floor((new Date(t.deadline).getTime() - Date.now()) / 86400000)
            return (
              <div key={t.id} className={cn('flex items-center gap-4 px-4 py-3', deadlineClass(t.deadline).replace('border-l-4', ''))}>
                <div className={cn('w-1 self-stretch rounded-full flex-shrink-0',
                  days < 0  ? 'bg-red-400'    :
                  days <= 1 ? 'bg-orange-400' :
                  days <= 3 ? 'bg-yellow-400' :
                  'bg-green-400'
                )} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-brand">{t.client_name}</p>
                  <p className="truncate text-sm font-medium text-ink-800">{t.title}</p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="text-[10px] text-ink-400">{TYPE_BADGE[t.content_type] ?? t.content_type}</span>
                    <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-medium', STATUS_COLOR[t.status] ?? 'bg-ink-100 text-ink-500')}>
                      {STATUS_LABEL[t.status] ?? t.status}
                    </span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-semibold text-ink-700">
                    {new Date(t.deadline).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </p>
                  <p className={cn('text-[11px] font-medium',
                    days < 0  ? 'text-red-500'    :
                    days <= 1 ? 'text-orange-500' :
                    days <= 3 ? 'text-yellow-600' :
                    'text-ink-400'
                  )}>
                    {days < 0  ? `${Math.abs(days)}d vencido` :
                     days === 0 ? 'Hoy'        :
                     days === 1 ? 'Mañana'     :
                     `en ${days} días`}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
