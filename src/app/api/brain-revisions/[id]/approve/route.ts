import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const service = await createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: revision } = await (service as any)
    .from('brand_brain_revisions')
    .select('*')
    .eq('id', id)
    .eq('status', 'pending')
    .single()

  if (!revision) return NextResponse.json({ error: 'Revision not found or already reviewed' }, { status: 404 })

  // Apply the proposed changes to the brand brain
  const { data: brain } = await service
    .from('brand_brains')
    .select('*')
    .eq('client_id', revision.client_id)
    .single()

  if (!brain) return NextResponse.json({ error: 'Brand brain not found' }, { status: 404 })

  const currentSection = (brain as unknown as Record<string, unknown>)[revision.section as string] ?? {}
  const merged = { ...(currentSection as Record<string, unknown>), ...(revision.proposed_changes as Record<string, unknown>) }

  await service
    .from('brand_brains')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({
      [revision.section]: merged,
      version: ((brain as unknown as Record<string, number>).version ?? 1) + 1,
      updated_at: new Date().toISOString(),
    } as any)
    .eq('client_id', revision.client_id)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (service as any)
    .from('brand_brain_revisions')
    .update({ status: 'approved', reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq('id', id)

  return NextResponse.json({ ok: true })
}
