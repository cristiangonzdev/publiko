import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/guards'

function randomPassword() {
  return 'Pub' + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 5) + '!'
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!auth.ctx.organizationId) {
    return NextResponse.json({ error: 'Tu usuario no tiene organización asignada' }, { status: 409 })
  }

  const supabase = await createServiceClient()
  const { full_name, email, role } = await request.json() as {
    full_name: string; email: string; role: string
  }

  if (!full_name || !email || !role) {
    return NextResponse.json({ error: 'full_name, email y role son requeridos' }, { status: 400 })
  }

  const password = randomPassword()

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const { error: profileError } = await supabase
    .from('profiles')
    // El nuevo usuario hereda la organización del admin que lo crea.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert({ id: data.user.id, full_name, email, role: role as any, organization_id: auth.ctx.organizationId })

  if (profileError) {
    await supabase.auth.admin.deleteUser(data.user.id)
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, password, userId: data.user.id })
}

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, is_active, created_at')
    .eq('organization_id', auth.ctx.organizationId ?? '00000000-0000-0000-0000-000000000000')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
