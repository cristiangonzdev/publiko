import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/guards'
import type { UserRole } from '@/types/supabase'

const VALID_ROLES: UserRole[] = ['admin', 'editor', 'grabador', 'cliente']

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { id } = await params
  const body = await request.json() as Record<string, unknown>

  // Whitelist: never accept arbitrary fields (id, email, etc. via mass-assignment)
  const update: { full_name?: string; role?: UserRole; phone?: string | null; is_active?: boolean; updated_at: string } = {
    updated_at: new Date().toISOString(),
  }
  if (typeof body.full_name === 'string') update.full_name = body.full_name
  if (typeof body.phone === 'string' || body.phone === null) update.phone = body.phone as string | null
  if (typeof body.is_active === 'boolean') update.is_active = body.is_active
  if (typeof body.role === 'string') {
    if (!VALID_ROLES.includes(body.role as UserRole)) {
      return NextResponse.json({ error: 'Rol inválido' }, { status: 400 })
    }
    update.role = body.role as UserRole
  }

  const supabase = await createServiceClient()
  const { error } = await supabase.from('profiles').update(update).eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { id } = await params
  const supabase = await createServiceClient()

  const { error } = await supabase
    .from('profiles')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
