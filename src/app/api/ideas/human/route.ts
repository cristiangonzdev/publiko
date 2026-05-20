import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { buildSystemPrompt } from '@/lib/claude'

const ai = new Anthropic()

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { client_id, human_input, content_type } = await request.json() as {
    client_id: string
    human_input: string
    content_type: 'reel' | 'post' | 'story' | 'carrusel'
  }

  const service = await createServiceClient()

  const { data: brain } = await service
    .from('brand_brains')
    .select('*')
    .eq('client_id', client_id)
    .single()

  const res = await ai.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1000,
    system: buildSystemPrompt((brain ?? {}) as Record<string, unknown>),
    messages: [
      {
        role: 'user',
        content: `Convierte esta idea humana en un guión estructurado de contenido, manteniendo la autenticidad de la historia.

FORMATO DESEADO: ${content_type}
INPUT HUMANO: "${human_input}"

Genera:
- Gancho de apertura (primeros 3 segundos que enganchen)
- Desarrollo (qué contar y cómo, sin ser un script rígido, máx. 3 puntos)
- Cierre + CTA natural
- Por qué este ángulo funciona ahora para esta marca

Responde SOLO en JSON:
{
  "concept": "título de la idea en 1 frase",
  "full_description": "el guión estructurado completo",
  "angle": "el ángulo principal (emocional/historia/social_proof/etc.)",
  "content_pillar": "pilar de contenido al que pertenece"
}`,
      },
    ],
  })

  const raw = res.content[0].type === 'text' ? res.content[0].text : '{}'
  const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  const generated = JSON.parse(text) as {
    concept: string; full_description: string; angle: string; content_pillar: string
  }

  const { data: idea } = await service
    .from('content_ideas')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert({
      client_id,
      concept: generated.concept,
      full_description: generated.full_description,
      content_type,
      content_origin: 'human',
      angle: generated.angle as any,
      content_pillar: generated.content_pillar,
      human_input,
      status: 'suggested',
    } as any)
    .select('id, concept, full_description')
    .single()

  return NextResponse.json({ idea })
}
