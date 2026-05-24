import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { generateWeeklyIdeas } from '@/lib/claude'
import { notifyAdmin } from '@/lib/telegram'
import { loadWinningPatterns, attachWinningPatterns } from '@/lib/winning-patterns/inject'
import { notifyClientNewWeeklyContent } from '@/lib/email/notifications'

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { client_id } = await request.json() as { client_id: string }
  if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

  const [{ data: brain }, { data: recentIdeas }, winningPatterns] = await Promise.all([
    supabase.from('brand_brains').select('*').eq('client_id', client_id).single(),
    supabase
      .from('content_ideas')
      .select('concept, angle, content_type, status')
      .eq('client_id', client_id)
      .order('created_at', { ascending: false })
      .limit(30),
    loadWinningPatterns(supabase, client_id),
  ])

  if (!brain?.onboarding_completed) {
    return NextResponse.json({ error: 'Brand Brain not completed' }, { status: 400 })
  }

  const weekContext = `Semana del ${new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`

  const brainWithPatterns = attachWinningPatterns(
    brain as unknown as Record<string, unknown>,
    winningPatterns,
  )

  let generated
  try {
    generated = await generateWeeklyIdeas(
      brainWithPatterns,
      (recentIdeas ?? []) as unknown as Array<Record<string, unknown>>,
      weekContext
    )
  } catch (err) {
    console.error('Claude error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }

  const VALID_ANGLES = ['emocional','informativo','humor','social_proof','educativo','aspiracional','detras_escenas','anuncio','opinion','historia']
  const VALID_TYPES = ['reel','post','story','carrusel','gmb_post']

  const sanitize = (idea: Record<string, unknown>) => ({
    ...idea,
    angle: VALID_ANGLES.includes(idea.angle as string) ? idea.angle : 'emocional',
    content_type: VALID_TYPES.includes(idea.content_type as string) ? idea.content_type : 'reel',
    content_origin: idea.content_origin === 'human' ? 'human' : 'system',
  })

  const allIdeas = [
    ...generated.system_ideas.map((idea) => ({
      ...sanitize(idea as unknown as Record<string, unknown>),
      client_id,
      status: 'suggested',
      can_recycle_after: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
    })),
    ...generated.human_ideas.map((idea) => ({
      ...sanitize(idea as unknown as Record<string, unknown>),
      client_id,
      status: 'suggested',
    })),
  ]

  const { data: inserted, error } = await supabase
    .from('content_ideas')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert(allIdeas as any)
    .select('id, concept, full_description, content_type, angle, content_origin, status')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const service = await createServiceClient()
  const { data: client } = await service
    .from('clients')
    .select('business_name, contact_email')
    .eq('id', client_id)
    .single()

  await notifyAdmin(
    `📋 <b>Plan semanal listo</b>\n\n${client?.business_name ?? client_id}\n${inserted?.length ?? 0} ideas generadas`,
  )

  if (client?.contact_email && (inserted?.length ?? 0) > 0) {
    const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://publiko.app'}/cliente/calendario`
    notifyClientNewWeeklyContent({
      to: client.contact_email,
      businessName: client.business_name ?? 'tu negocio',
      ideaCount: inserted?.length ?? 0,
      portalUrl,
    }).catch((err) => console.error('[email] notify client failed', err))
  }

  return NextResponse.json({ ideas: inserted, count: inserted?.length ?? 0 })
}
