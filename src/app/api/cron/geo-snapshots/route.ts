import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { generateGeoQueries, simulateGeoQuery } from '@/lib/claude'

export const maxDuration = 300

interface GeoClient {
  id: string
  geo_location: string
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createServiceClient()

  // geo_tracking_enabled and geo_location added in migration 0011 — cast via as any
  const { data: rawClients } = await supabase
    .from('clients')
    .select('id, geo_location')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .eq('geo_tracking_enabled' as any, true)
    .not('geo_location', 'is', null)

  const clients = (rawClients ?? []) as unknown as GeoClient[]

  if (clients.length === 0) {
    return NextResponse.json({ ok: true, processed: 0 })
  }

  const results = await Promise.all(
    clients.map(async (c) => {
      try {
        const { data: brain } = await supabase
          .from('brand_brains')
          .select('identity')
          .eq('client_id', c.id)
          .single()

        if (!brain) return { client_id: c.id, error: 'no brain' }

        const queries = await generateGeoQueries(
          brain as unknown as Record<string, unknown>,
          c.geo_location,
        )

        const snapshots = await Promise.all(
          queries.map((q) =>
            simulateGeoQuery(brain as unknown as Record<string, unknown>, q),
          ),
        )

        const rows = snapshots.map((s) => ({
          client_id: c.id,
          query: s.query,
          ai_response_excerpt: s.ai_response_excerpt,
          brand_mentioned: s.brand_mentioned,
          brand_position: s.brand_position,
          brand_sentiment: s.brand_sentiment,
        }))

        // ai_visibility_snapshots added in migration 0011 — cast via as any
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('ai_visibility_snapshots').insert(rows)

        return { client_id: c.id, snapshots: snapshots.length }
      } catch (err) {
        return { client_id: c.id, error: err instanceof Error ? err.message : String(err) }
      }
    }),
  )

  return NextResponse.json({ ok: true, results })
}
