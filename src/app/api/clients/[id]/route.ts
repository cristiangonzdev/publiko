import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireClientAccess } from '@/lib/auth/guards'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // Admin de la org del cliente (el guard verifica organization_id).
  const auth = await requireClientAccess(id, { adminOnly: true })
  if (!auth.ok) return auth.response

  const supabase = await createServiceClient()

  const { error } = await supabase
    .from('clients')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
