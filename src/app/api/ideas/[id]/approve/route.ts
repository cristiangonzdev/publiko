import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { generateCopyOptions, generateBriefs } from '@/lib/claude'
import { notifyAdmin } from '@/lib/telegram'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = await createServiceClient()

  const { data: idea } = await service
    .from('content_ideas')
    .select('*, clients!inner(business_name)')
    .eq('id', id)
    .single()

  if (!idea) return NextResponse.json({ error: 'Idea not found' }, { status: 404 })

  const { data: brain } = await service
    .from('brand_brains')
    .select('*')
    .eq('client_id', idea.client_id)
    .single()

  await service
    .from('content_ideas')
    .update({ status: 'approved', approved_at: new Date().toISOString(), approved_by: user.id })
    .eq('id', id)

  try {
    const ideaRecord = idea as unknown as Record<string, unknown>
    const brainRecord = (brain ?? {}) as unknown as Record<string, unknown>

    const [copyOptions, briefs] = await Promise.all([
      generateCopyOptions(brainRecord, ideaRecord),
      generateBriefs(brainRecord, ideaRecord),
    ])

    const { data: task } = await service
      .from('content_tasks')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert({
        client_id: idea.client_id,
        idea_id: id,
        title: idea.concept,
        content_type: idea.content_type,
        copy_options: copyOptions,
        recording_brief: briefs.recording_brief,
        editing_brief: briefs.editing_brief,
        target_platforms: [],
        status: 'approved_idea',
      } as any)
      .select('id')
      .single()

    await service
      .from('content_ideas')
      .update({ content_task_id: task?.id ?? null })
      .eq('id', id)

    const businessName = (idea.clients as unknown as { business_name: string })?.business_name ?? ''
    await notifyAdmin(`✅ <b>Idea aprobada</b>\n\n${businessName}\n${idea.concept}\n\nTarea de producción creada.`)

    return NextResponse.json({ ok: true, task_id: task?.id })
  } catch {
    return NextResponse.json({ ok: true, task_id: null })
  }
}
