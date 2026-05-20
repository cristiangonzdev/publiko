import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { generateCopiesPerPlatform } from '@/lib/claude'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({})) as { platforms?: string[] }
  const requestedPlatforms = body.platforms

  const service = await createServiceClient()
  const { data: task } = await service
    .from('content_tasks')
    .select('id, client_id, title, content_type, target_platforms, recording_brief')
    .eq('id', id)
    .single()
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  const platforms = requestedPlatforms && requestedPlatforms.length > 0
    ? requestedPlatforms
    : (task.target_platforms as string[]) ?? ['instagram']

  const { data: brain } = await service.from('brand_brains').select('*').eq('client_id', task.client_id).single()

  const { data: idea } = await service
    .from('content_ideas')
    .select('concept, full_description, content_type, angle')
    .eq('content_task_id', id)
    .maybeSingle()

  const ideaPayload = idea ?? {
    concept: task.title,
    full_description: (task.recording_brief as Record<string, unknown> | null)?.concept ?? '',
    content_type: task.content_type,
    angle: '',
  }

  let perPlatform
  try {
    perPlatform = await generateCopiesPerPlatform(
      brain as unknown as Record<string, unknown>,
      ideaPayload as unknown as Record<string, unknown>,
      platforms,
    )
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }

  await service
    .from('content_tasks')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({
      copies_per_platform: perPlatform,
      target_platforms: platforms,
      updated_at: new Date().toISOString(),
    } as any)
    .eq('id', id)

  return NextResponse.json({ copies_per_platform: perPlatform })
}
