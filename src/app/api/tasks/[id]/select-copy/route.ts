import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

interface CopyOption {
  copy?: string
  hashtags?: string[]
  cta?: string
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { copy_index } = await request.json() as { copy_index: number }
  if (typeof copy_index !== 'number' || copy_index < 0) {
    return NextResponse.json({ error: 'copy_index required' }, { status: 400 })
  }

  const service = await createServiceClient()

  const { data: task } = await service
    .from('content_tasks')
    .select('id, copy_options')
    .eq('id', id)
    .single()

  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  const options = (task.copy_options ?? []) as CopyOption[]
  const chosen = options[copy_index]
  if (!chosen) return NextResponse.json({ error: 'copy_index out of range' }, { status: 400 })

  const { error } = await service
    .from('content_tasks')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({
      copy_selected: chosen.copy ?? '',
      hashtags: chosen.hashtags ?? [],
      cta: chosen.cta ?? null,
      updated_at: new Date().toISOString(),
    } as any)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, copy_index })
}
