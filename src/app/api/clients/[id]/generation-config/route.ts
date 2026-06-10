import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/guards'

export const runtime = 'nodejs'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { id } = await params

  const config = await request.json() as Record<string, unknown>

  // Light validation: numeric fields are numbers >= 0, arrays are arrays
  for (const k of ['reels_per_day', 'posts_per_day', 'stories_per_day', 'carrusels_per_day']) {
    if (config[k] != null && (typeof config[k] !== 'number' || (config[k] as number) < 0)) {
      return NextResponse.json({ error: `${k} must be a non-negative number` }, { status: 400 })
    }
  }
  for (const k of ['auto_tier_content_types', 'publish_hours', 'platforms']) {
    if (config[k] != null && !Array.isArray(config[k])) {
      return NextResponse.json({ error: `${k} must be an array` }, { status: 400 })
    }
  }

  const service = await createServiceClient()
  const { error } = await service
    .from('clients')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ daily_generation_config: config, updated_at: new Date().toISOString() } as any)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, config })
}
