import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireTaskAccess } from '@/lib/auth/guards'

/**
 * Transiciones de estado permitidas (from -> [to válidos]) según el lifecycle
 * de contenido. Cualquier estado puede pasar a 'discarded' (lo controla el admin).
 */
const ALLOWED: Record<string, string[]> = {
  idea: ['approved_idea', 'discarded'],
  suggested: ['approved_idea', 'discarded'],
  approved_idea: ['brief_sent', 'discarded'],
  brief_sent: ['recording', 'discarded'],
  recording: ['brutos_ready', 'discarded'],
  brutos_ready: ['editing', 'discarded'],
  editing: ['delivered', 'discarded'],
  delivered: ['revision', 'approved', 'discarded'],
  revision: ['editing', 'discarded'],
  approved: ['scheduled', 'discarded'],
  scheduled: ['published', 'failed', 'discarded'],
  published: ['discarded'],
  failed: ['discarded'],
  discarded: [],
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireTaskAccess(id, { roles: [] })
  if (!auth.ok) return auth.response

  const body = await request.json() as { status: string; publish_at?: string }
  if (!body.status) return NextResponse.json({ error: 'status required' }, { status: 400 })

  const supabase = await createServiceClient()

  const { data: current } = await supabase
    .from('content_tasks')
    .select('status')
    .eq('id', id)
    .single()

  if (!current) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  const from = (current as { status: string }).status
  // Permitir un no-op (mismo estado) y bloquear transiciones no listadas.
  if (body.status !== from && !(ALLOWED[from] ?? []).includes(body.status)) {
    return NextResponse.json(
      { error: `Transición de estado inválida: ${from} → ${body.status}` },
      { status: 409 },
    )
  }

  const updates: Record<string, string> = {
    status: body.status,
    updated_at: new Date().toISOString(),
  }
  if (body.status === 'editing') updates.editing_started_at = new Date().toISOString()
  if (body.status === 'approved') updates.approved_at = new Date().toISOString()
  if (body.publish_at) updates.publish_at = body.publish_at

  const { error } = await supabase
    .from('content_tasks')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(updates as any)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
