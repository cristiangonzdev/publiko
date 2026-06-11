import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireClientAccess } from '@/lib/auth/guards'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireClientAccess(id, { adminOnly: true })
  if (!auth.ok) return auth.response

  const { idea_id, concept, angle, content_type } = await request.json() as {
    idea_id: string
    concept: string
    angle: string
    content_type: string
  }

  const service = await createServiceClient()

  const { data: brain } = await service
    .from('brand_brains')
    .select('performance_learning')
    .eq('client_id', id)
    .single()

  if (!brain) return NextResponse.json({ error: 'Brain not found' }, { status: 404 })

  const learning = (brain.performance_learning as Record<string, unknown>) ?? {}
  const highlights = (learning.highlights as Array<Record<string, string>>) ?? []

  const alreadyMarked = highlights.find((h) => h.idea_id === idea_id)
  if (alreadyMarked) return NextResponse.json({ ok: true, already: true })

  const newHighlight = { idea_id, concept: concept.slice(0, 120), angle, content_type, date: new Date().toISOString().slice(0, 10) }
  const updatedHighlights = [newHighlight, ...highlights].slice(0, 20)

  // Derive best_content_type and best_format from frequency
  const typeCounts = updatedHighlights.reduce<Record<string, number>>((acc, h) => {
    acc[h.content_type] = (acc[h.content_type] ?? 0) + 1
    return acc
  }, {})
  const angleCounts = updatedHighlights.reduce<Record<string, number>>((acc, h) => {
    acc[h.angle] = (acc[h.angle] ?? 0) + 1
    return acc
  }, {})
  const bestType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? content_type
  const bestAngle = Object.entries(angleCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? angle

  const updatedLearning = {
    ...learning,
    highlights: updatedHighlights,
    top_performing: {
      ...(learning.top_performing as Record<string, unknown> ?? {}),
      best_content_type: bestType,
      best_format: bestAngle,
    },
  }

  await service
    .from('brand_brains')
    .update({ performance_learning: updatedLearning, updated_at: new Date().toISOString() })
    .eq('client_id', id)

  await service
    .from('content_ideas')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', idea_id)

  return NextResponse.json({ ok: true })
}
