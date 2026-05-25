import type { SupabaseClient } from '@supabase/supabase-js'

export type NotificationType =
  | 'brutos_ready'
  | 'deliverable_sent'
  | 'review_rejected'
  | 'task_assigned'

interface CreateNotificationInput {
  userId: string
  type: NotificationType
  title: string
  body?: string
  taskId?: string
  clientName?: string
}

export async function createNotification(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: SupabaseClient<any>,
  input: CreateNotificationInput,
) {
  await service.from('notifications').insert({
    user_id: input.userId,
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    task_id: input.taskId ?? null,
    client_name: input.clientName ?? null,
  })
}

export function notifTitle(type: NotificationType, taskTitle: string): string {
  switch (type) {
    case 'brutos_ready':    return `Brutos listos: ${taskTitle}`
    case 'deliverable_sent': return `Entregable recibido: ${taskTitle}`
    case 'review_rejected': return `Revisión solicitada: ${taskTitle}`
    case 'task_assigned':   return `Nueva tarea asignada: ${taskTitle}`
  }
}
