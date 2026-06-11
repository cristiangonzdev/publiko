import { after } from 'next/server'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getAuthContext, orgMismatch } from '@/lib/auth/guards'
import { generateCopyOptions, generateBriefs, generateCopiesPerPlatform } from '@/lib/claude'
import { notifyAdmin } from '@/lib/telegram'
import { loadWinningPatterns, attachWinningPatterns } from '@/lib/winning-patterns/inject'
import { loadWinnerExamples } from '@/lib/winning-patterns/examples'

// La generación de briefs corre en after() pero cuenta dentro de la duración
// de la función: sin esto Vercel mata el proceso a mitad de generación.
export const maxDuration = 120

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (ctx.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const service = await createServiceClient()

  const { data: idea } = await service
    .from('content_ideas')
    .select('*, clients!inner(business_name, daily_generation_config, organization_id)')
    .eq('id', id)
    .single()

  if (!idea) return NextResponse.json({ error: 'Idea not found' }, { status: 404 })

  // El service client bypasea RLS: la idea debe pertenecer a la org del admin.
  const ideaOrg = (idea.clients as unknown as { organization_id: string | null })?.organization_id
  if (orgMismatch(ctx, ideaOrg)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

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
    .update({ status: 'approved', approved_at: new Date().toISOString(), approved_by: ctx.userId })
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
    } catch (err) {
      console.error(`[approve] brief generation failed for idea ${id}:`, err)
      await service
        .from('content_tasks')
        .update({ admin_notes: '⚠️ Error generando briefs automáticamente. Usa "Reintentar briefs" en el drawer.' } as any)
        .eq('id', task.id)
      const clientData = idea.clients as unknown as { business_name: string }
      await notifyAdmin(
        `⚠️ <b>Error generando briefs</b>\n\nCliente: ${clientData?.business_name ?? ''}\nIdea: ${idea.concept}\n\nAbre el drawer y pulsa "Reintentar briefs".\n\nError: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  })

  return NextResponse.json({ ok: true, task_id: task?.id })
}
