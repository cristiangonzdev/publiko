import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: brain } = await supabase
    .from('brand_brains')
    .select('brand_name, category, unique_value, tone_voice, audience_description, products_services, visual_references, content_pillars, avoid_topics')
    .eq('client_id', id)
    .single()

  return NextResponse.json({ brain: brain ?? null })
}
