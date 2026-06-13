import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireClientAccess } from '@/lib/auth/guards'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // Admin de la org del cliente (el guard verifica organization_id).
  const auth = await requireClientAccess(id, { adminOnly: true })
  if (!auth.ok) return auth.response

  const supabase = await createServiceClient()

  // Soft-delete: además de marcar deleted_at hay que desactivar el cliente.
  // El RPC get_mrr_total y el dashboard cuentan por is_active=true, así que sin
  // esto un cliente borrado seguiría sumando al MRR y al contador de activos.
  const { error } = await supabase
    .from('clients')
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq('id', id)
    .is('deleted_at', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
