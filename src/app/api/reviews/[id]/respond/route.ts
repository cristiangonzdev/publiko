import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { response } = await request.json() as { response: string }
  if (!response?.trim()) return NextResponse.json({ error: 'response required' }, { status: 400 })

  const { error } = await supabase
    .from('reviews')
    .update({
      response_selected: response,
      response_published_at: new Date().toISOString(),
      responded_by: user.id,
      status: 'responded',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
