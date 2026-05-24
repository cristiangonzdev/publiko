import { cn } from '@/lib/utils'

interface Task {
  id: string
  deadline: string | null
  status: string
}

interface Props {
  tasks: Task[]
  role: 'editor' | 'grabador'
}

function classifyTask(task: Task): 'overdue' | 'urgent' | 'soon' | 'ok' {
  if (!task.deadline) return 'ok'
  const days = Math.floor((new Date(task.deadline).getTime() - Date.now()) / 86400000)
  if (days < 0)  return 'overdue'
  if (days <= 1) return 'urgent'
  if (days <= 3) return 'soon'
  return 'ok'
}

export function WorkloadSummary({ tasks, role }: Props) {
  const overdue = tasks.filter((t) => classifyTask(t) === 'overdue').length
  const urgent  = tasks.filter((t) => classifyTask(t) === 'urgent').length
  const soon    = tasks.filter((t) => classifyTask(t) === 'soon').length
  const total   = tasks.length

  const statusLabel = role === 'editor' ? 'tareas en curso' : 'grabaciones en curso'

  const health = overdue > 0 ? 'critical' : urgent > 0 ? 'warning' : 'good'

  return (
    <div className={cn(
      'mb-6 rounded-xl border p-4',
      health === 'critical' ? 'border-red-200 bg-red-50'   :
      health === 'warning'  ? 'border-amber-200 bg-amber-50' :
      'border-green-200 bg-green-50'
    )}>
      <div className="flex items-center justify-between">
        <div>
          <p className={cn(
            'text-xs font-semibold uppercase tracking-widest',
            health === 'critical' ? 'text-red-500'   :
            health === 'warning'  ? 'text-amber-600' :
            'text-green-600'
          )}>
            {health === 'critical' ? 'Atención requerida' :
             health === 'warning'  ? 'Urgente esta semana' :
             'Todo en orden'}
          </p>
          <p className={cn(
            'mt-0.5 text-2xl font-bold',
            health === 'critical' ? 'text-red-700'   :
            health === 'warning'  ? 'text-amber-700' :
            'text-green-700'
          )}>
            {total}
            <span className={cn(
              'ml-1.5 text-sm font-normal',
              health === 'critical' ? 'text-red-500'   :
              health === 'warning'  ? 'text-amber-600' :
              'text-green-600'
            )}>
              {statusLabel}
            </span>
          </p>
        </div>

        <div className="flex gap-3 text-center">
          {overdue > 0 && (
            <div className="rounded-lg bg-red-100 px-3 py-1.5">
              <p className="text-lg font-bold text-red-700">{overdue}</p>
              <p className="text-[10px] font-medium text-red-500 uppercase tracking-wide">Vencidas</p>
            </div>
          )}
          {urgent > 0 && (
            <div className="rounded-lg bg-amber-100 px-3 py-1.5">
              <p className="text-lg font-bold text-amber-700">{urgent}</p>
              <p className="text-[10px] font-medium text-amber-500 uppercase tracking-wide">Hoy/Mañana</p>
            </div>
          )}
          {soon > 0 && (
            <div className="rounded-lg bg-yellow-100 px-3 py-1.5">
              <p className="text-lg font-bold text-yellow-700">{soon}</p>
              <p className="text-[10px] font-medium text-yellow-600 uppercase tracking-wide">Esta semana</p>
            </div>
          )}
          {overdue === 0 && urgent === 0 && soon === 0 && total > 0 && (
            <div className="rounded-lg bg-green-100 px-3 py-1.5">
              <p className="text-lg font-bold text-green-700">{total}</p>
              <p className="text-[10px] font-medium text-green-600 uppercase tracking-wide">Sin urgencia</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
