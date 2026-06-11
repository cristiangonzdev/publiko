import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types/supabase'

export interface AuthContext {
  userId: string
  role: UserRole
  email: string
  /** Organización del usuario. Null solo si el profile no existe aún. */
  organizationId: string | null
}

/**
 * Returns the authenticated user + role + org, or null. Safe for API routes
 * (unlike getAuthUser() which redirects and cannot run inside a route handler).
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, email, organization_id')
    .eq('id', user.id)
    .single()
  return {
    userId: user.id,
    role: (profile?.role ?? 'cliente') as UserRole,
    email: profile?.email ?? user.email ?? '',
    organizationId: profile?.organization_id ?? null,
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

/**
 * True si la fila NO pertenece a la org del usuario. Para usar tras
 * cargar un recurso con el service client (que bypasea RLS): el
 * aislamiento entre organizaciones depende de este check.
 */
export function orgMismatch(ctx: AuthContext, rowOrgId: string | null | undefined): boolean {
  return !ctx.organizationId || !rowOrgId || ctx.organizationId !== rowOrgId
}

interface TaskRow {
  id: string
  client_id: string
  status: string
  grabador_id: string | null
  editor_id: string | null
}

/**
 * Authenticated user who is admin (of the task's org) OR the assigned
 * grabador/editor of the task. Loads the task with the service client
 * (auth already verified above) and returns it so callers can reuse it.
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
    .select('id, client_id, status, grabador_id, editor_id, clients(organization_id)')
    .eq('id', taskId)
    .single()

  if (!task) return { ok: false, response: NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 }) }

  const t = task as unknown as TaskRow & { clients: { organization_id: string | null } | null }

  if (ctx.role === 'admin') {
    // El service client bypasea RLS: el admin solo accede a tareas de su org.
    if (orgMismatch(ctx, t.clients?.organization_id)) {
      return { ok: false, response: forbidden() }
    }
    return { ok: true, ctx, task: t }
  }

  const allowed = opts.roles ?? ['grabador', 'editor']
  const isGrabador = allowed.includes('grabador') && t.grabador_id === ctx.userId
  const isEditor = allowed.includes('editor') && t.editor_id === ctx.userId
  if (isGrabador || isEditor) return { ok: true, ctx, task: t }

  return { ok: false, response: forbidden() }
}

/**
 * Authenticated user who is admin (of the client's org) OR the owner
 * (client_user_id) of the client.
 */
export async function requireClientAccess(
  clientId: string,
  opts: { adminOnly?: boolean } = {},
): Promise<Guard> {
  const ctx = await getAuthContext()
  if (!ctx) return { ok: false, response: unauthorized() }

  const svc = await createServiceClient()
  const { data: client } = await svc
    .from('clients')
    .select('client_user_id, organization_id')
    .eq('id', clientId)
    .single()
  if (!client) return { ok: false, response: NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 }) }

  const row = client as { client_user_id: string | null; organization_id: string | null }

  if (ctx.role === 'admin') {
    if (orgMismatch(ctx, row.organization_id)) return { ok: false, response: forbidden() }
    return { ok: true, ctx }
  }
  if (opts.adminOnly) return { ok: false, response: forbidden() }

  if (row.client_user_id === ctx.userId) return { ok: true, ctx }
  return { ok: false, response: forbidden() }
}

/**
 * Admin de la org a la que pertenece la factura. Devuelve el guard con ctx;
 * el caller vuelve a cargar la factura con los campos que necesite.
 */
export async function requireInvoiceAccess(invoiceId: string): Promise<Guard> {
  const auth = await requireAdmin()
  if (!auth.ok) return auth

  const svc = await createServiceClient()
  const { data: invoice } = await svc
    .from('invoices')
    .select('organization_id')
    .eq('id', invoiceId)
    .single()
  if (!invoice) return { ok: false, response: NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 }) }
  if (orgMismatch(auth.ctx, (invoice as { organization_id: string | null }).organization_id)) {
    return { ok: false, response: forbidden() }
  }
  return auth
}
