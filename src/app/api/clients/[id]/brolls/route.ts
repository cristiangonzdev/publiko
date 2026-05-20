import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: brolls } = await supabase
    .from('assets')
    .select('id, file_name, file_type, file_size, public_url, storage_path, description, tags, created_at')
    .eq('client_id', id)
    .eq('asset_category', 'b_roll')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  return NextResponse.json({ brolls: brolls ?? [] })
}
