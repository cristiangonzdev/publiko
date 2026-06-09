import { after } from 'next/server'
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { generateCopyOptions, generateBriefs, generateCopiesPerPlatform } from '@/lib/claude'
import { notifyAdmin } from '@/lib/telegram'
import { loadWinningPatterns, attachWinningPatterns } from '@/lib/winning-patterns/inject'
import { loadWinnerExamples } from '@/lib/winning-patterns/examples'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const service = await createServiceClient()

  const { data: idea } = await service
    .from('content_ideas')
    .select('*, clients!inner(business_name, daily_generation_config)')
    .eq('id', id)
    .single()

  if (!idea) return NextResponse.json({ error: 'Idea not found' }, { status: 404 })

  const [{ data: brain }, winningPatterns] = await Promise.all([
    service
      .from('brand_brains')
      .select('*')
      .eq('client_id', idea.client_id)
      .single(),
    loadWinningPatterns(service, idea.client_id as string),
  ])

  await service
    .from('content_ideas')
    .update({ status: 'approved', approved_at: new Date().toISOString(), approved_by: user.id })
    .eq('id', id)

  // Create task immediately (empty briefs) so the drawer opens right away
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: task, error: taskError } = await service
    .from('content_tasks')
    .insert({
      client_id: idea.client_id,
      idea_id: id,
      title: idea.concept,
      content_type: idea.content_type,
      copy_options: [],
      recording_brief: {},
      editing_brief: {},
      target_platforms: [],
      status: 'approved_idea',
    } as any)
    .select('id')
    .single()

  if (taskError || !task) {
    return NextResponse.json({ error: 'Error creando tarea de producción', detail: taskError?.message }, { status: 500 })
  }

  await service
    .from('content_ideas')
    .update({ content_task_id: task.id })
    .eq('id', id)

  // Generate briefs after the response is sent — user sees the drawer immediately
  after(async () => {
    try {
      const ideaRecord = idea as unknown as Record<string, unknown>
      const brainRecord = attachWinningPatterns(
        (brain ?? {}) as unknown as Record<string, unknown>,
        winningPatterns,
      )

      const fewShotExamples = await loadWinnerExamples(idea.client_id as string)

      const clientData = idea.clients as unknown as { business_name: string; daily_generation_config: Record<string, unknown> | null }
      const platforms = ((clientData?.daily_generation_config?.platforms as string[]) ?? ['instagram'])

      const [copyOptions, briefs, perPlatform] = await Promise.all([
        generateCopyOptions(brainRecord, ideaRecord, fewShotExamples),
        generateBriefs(brainRecord, ideaRecord),
        generateCopiesPerPlatform(brainRecord, ideaRecord, platforms, fewShotExamples),
      ])

      await service
        .from('content_tasks')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update({
          copy_options: copyOptions as any,
          copies_per_platform: perPlatform as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          target_platforms: platforms as any,
          recording_brief: briefs.recording_brief as any,
          editing_brief: briefs.editing_brief as any,
        })
        .eq('id', task.id)

      const businessName = clientData?.business_name ?? ''
      await notifyAdmin(`✅ <b>Idea aprobada</b>\n\n${businessName}\n${idea.concept}\n\nTarea creada con copies para: ${platforms.join(', ')}.`)
    } catch {
      // Brief generation failed — task stays with null briefs, user can retry
    }
  })

  return NextResponse.json({ ok: true, task_id: task?.id })
}
