import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types/supabase'

export interface AuthContext {
  userId: string
  role: UserRole
  email: string
}

/**
 * Returns the authenticated user + role, or null. Safe for API routes
 * (unlike getAuthUser() which redirects and cannot run inside a route handler).
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, email')
    .eq('id', user.id)
    .single()
  return {
    userId: user.id,
    role: (profile?.role ?? 'cliente') as UserRole,
    email: profile?.email ?? user.email ?? '',
  }
}

export type Guard =
  | { ok: true; ctx: AuthContext }
  | { ok: false; response: NextResponse }

export type TaskGuard =
  | { ok: true; ctx: AuthContext; task: TaskRow }
  | { ok: false; response: NextResponse }

const unauthorized = () =>
  NextResponse.json({ error: 'No autenticado' }, { status: 401 })
const forbidden = () =>
  NextResponse.json({ error: 'Prohibido' }, { status: 403 })

/** Any authenticated user. */
export async function requireAuth(): Promise<Guard> {
  const ctx = await getAuthContext()
  if (!ctx) return { ok: false, response: unauthorized() }
  return { ok: true, ctx }
}

/** Authenticated user whose role is in the allowed list. */
export async function requireRole(...roles: UserRole[]): Promise<Guard> {
  const ctx = await getAuthContext()
  if (!ctx) return { ok: false, response: unauthorized() }
  if (!roles.includes(ctx.role)) return { ok: false, response: forbidden() }
  return { ok: true, ctx }
}

/** Admin only. */
export function requireAdmin(): Promise<Guard> {
  return requireRole('admin')
}

interface TaskRow {
  id: string
  client_id: string
  status: string
  grabador_id: string | null
  editor_id: string | null
}

/**
 * Authenticated user who is admin OR the assigned grabador/editor of the task.
 * Loads the task with the service client (auth already verified above) and
 * returns it so callers can reuse it (and re-check status transitions).
 */
export async function requireTaskAccess(
  taskId: string,
  opts: { roles?: ('grabador' | 'editor')[] } = {},
): Promise<TaskGuard> {
  const ctx = await getAuthContext()
  if (!ctx) return { ok: false, response: unauthorized() }

  const svc = await createServiceClient()
  const { data: task } = await svc
    .from('content_tasks')
    .select('id, client_id, status, grabador_id, editor_id')
    .eq('id', taskId)
    .single()

  if (!task) return { ok: false, response: NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 }) }

  const t = task as TaskRow
  if (ctx.role === 'admin') return { ok: true, ctx, task: t }

  const allowed = opts.roles ?? ['grabador', 'editor']
  const isGrabador = allowed.includes('grabador') && t.grabador_id === ctx.userId
  const isEditor = allowed.includes('editor') && t.editor_id === ctx.userId
  if (isGrabador || isEditor) return { ok: true, ctx, task: t }

  return { ok: false, response: forbidden() }
}

/**
 * Authenticated user who is admin OR the owner (client_user_id) of the client.
 */
export async function requireClientAccess(
  clientId: string,
  opts: { adminOnly?: boolean } = {},
): Promise<Guard> {
  const ctx = await getAuthContext()
  if (!ctx) return { ok: false, response: unauthorized() }
  if (ctx.role === 'admin') return { ok: true, ctx }
  if (opts.adminOnly) return { ok: false, response: forbidden() }

  const svc = await createServiceClient()
  const { data: client } = await svc
    .from('clients')
    .select('client_user_id')
    .eq('id', clientId)
    .single()

  if (client && (client as { client_user_id: string | null }).client_user_id === ctx.userId) {
    return { ok: true, ctx }
  }
  return { ok: false, response: forbidden() }
}
