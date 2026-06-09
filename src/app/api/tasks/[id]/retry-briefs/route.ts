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

  const { data: task } = await service
    .from('content_tasks')
    .select('id, client_id, idea_id, title')
    .eq('id', id)
    .single()

  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  if (!task.idea_id) return NextResponse.json({ error: 'Task has no associated idea' }, { status: 400 })

  const { data: idea } = await service
    .from('content_ideas')
    .select('*')
    .eq('id', task.idea_id as string)
    .single()

  if (!idea) return NextResponse.json({ error: 'Idea not found' }, { status: 404 })

  const { data: client } = await service
    .from('clients')
    .select('business_name, daily_generation_config')
    .eq('id', task.client_id)
    .single()

  const [{ data: brain }, winningPatterns] = await Promise.all([
    service.from('brand_brains').select('*').eq('client_id', task.client_id).single(),
    loadWinningPatterns(service, task.client_id as string),
  ])

  const ideaRecord = idea as unknown as Record<string, unknown>
  const brainRecord = attachWinningPatterns(
    (brain ?? {}) as unknown as Record<string, unknown>,
    winningPatterns,
  )

  const fewShotExamples = await loadWinnerExamples(task.client_id as string)
  const config = client?.daily_generation_config as Record<string, unknown> | null
  const platforms = ((config?.platforms as string[]) ?? ['instagram'])

  try {
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
        target_platforms: platforms as any,
        recording_brief: briefs.recording_brief as any,
        editing_brief: briefs.editing_brief as any,
        admin_notes: null,
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', id)

    await notifyAdmin(`✅ <b>Briefs regenerados</b>\n\n${client?.business_name ?? ''}\n${idea.concept}`)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(`[retry-briefs] failed for task ${id}:`, err)
    return NextResponse.json(
      { error: 'Error generando briefs', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
