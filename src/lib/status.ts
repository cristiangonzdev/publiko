import type { ContentStatus, ClientStatus } from '@/types/supabase'

/**
 * Single source of truth for status labels/colors. Previously these maps were
 * duplicated across ~12 files with subtly divergent Spanish labels.
 */

export interface StatusStyle {
  label: string
  /** Tailwind classes for a badge (bg + text). */
  badge: string
}

export const CONTENT_STATUS: Record<ContentStatus, StatusStyle> = {
  idea: { label: 'Idea', badge: 'bg-slate-100 text-slate-700' },
  approved_idea: { label: 'Idea aprobada', badge: 'bg-indigo-100 text-indigo-700' },
  brief_sent: { label: 'Brief enviado', badge: 'bg-blue-100 text-blue-700' },
  recording: { label: 'Grabando', badge: 'bg-amber-100 text-amber-700' },
  brutos_ready: { label: 'Brutos listos', badge: 'bg-yellow-100 text-yellow-800' },
  editing: { label: 'Editando', badge: 'bg-purple-100 text-purple-700' },
  delivered: { label: 'Entregado', badge: 'bg-cyan-100 text-cyan-700' },
  revision: { label: 'En revisión', badge: 'bg-orange-100 text-orange-700' },
  approved: { label: 'Aprobado', badge: 'bg-emerald-100 text-emerald-700' },
  scheduled: { label: 'Programado', badge: 'bg-teal-100 text-teal-700' },
  published: { label: 'Publicado', badge: 'bg-green-100 text-green-700' },
  failed: { label: 'Fallido', badge: 'bg-red-100 text-red-700' },
}

export const CLIENT_STATUS: Record<ClientStatus, StatusStyle> = {
  lead: { label: 'Lead', badge: 'bg-slate-100 text-slate-700' },
  proposal_sent: { label: 'Propuesta enviada', badge: 'bg-blue-100 text-blue-700' },
  negotiation: { label: 'Negociación', badge: 'bg-amber-100 text-amber-700' },
  active: { label: 'Activo', badge: 'bg-green-100 text-green-700' },
  paused: { label: 'Pausado', badge: 'bg-orange-100 text-orange-700' },
  churned: { label: 'Baja', badge: 'bg-red-100 text-red-700' },
}

export const INVOICE_STATUS: Record<string, StatusStyle> = {
  pending: { label: 'Pendiente', badge: 'bg-amber-100 text-amber-800' },
  sent: { label: 'Enviada', badge: 'bg-blue-100 text-blue-700' },
  paid: { label: 'Pagada', badge: 'bg-green-100 text-green-700' },
  overdue: { label: 'Vencida', badge: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Anulada', badge: 'bg-slate-100 text-slate-500' },
}

export function invoiceStatusStyle(status: string): StatusStyle {
  return INVOICE_STATUS[status] ?? { label: status, badge: 'bg-slate-100 text-slate-700' }
}

/** Idea-level statuses (free text on content_ideas.status). */
export const IDEA_STATUS_LABELS: Record<string, string> = {
  suggested: 'Sugerida',
  approved: 'Aprobada',
  in_production: 'En producción',
  published: 'Publicada',
  discarded: 'Descartada',
  recycled: 'Reciclada',
}

export function contentStatusStyle(status: string): StatusStyle {
  return CONTENT_STATUS[status as ContentStatus] ?? { label: status, badge: 'bg-slate-100 text-slate-700' }
}

export function clientStatusStyle(status: string): StatusStyle {
  return CLIENT_STATUS[status as ClientStatus] ?? { label: status, badge: 'bg-slate-100 text-slate-700' }
}
