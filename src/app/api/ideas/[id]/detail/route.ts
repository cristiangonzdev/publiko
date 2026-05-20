import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: idea } = await supabase
    .from('content_ideas')
    .select('*')
    .eq('id', id)
    .single()

  if (!idea) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: task } = await supabase
    .from('content_tasks')
    .select('id, recording_brief, editing_brief, copy_options, copy_selected, hashtags, cta, status, grabador_id, editor_id, deadline, bruto_asset_ids')
    .eq('idea_id', id)
    .maybeSingle()

  return NextResponse.json({ idea, task: task ?? null })
}
