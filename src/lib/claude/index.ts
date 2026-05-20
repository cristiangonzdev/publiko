import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export function buildSystemPrompt(brandBrain: Record<string, unknown>): string {
  const id = (brandBrain.identity as Record<string, string>) ?? {}
  const audience = (brandBrain.audience as Record<string, unknown>) ?? {}
  const primary = (audience.primary as Record<string, string>) ?? {}
  const voice = (brandBrain.voice as Record<string, unknown>) ?? {}
  const competitive = (brandBrain.competitive as Record<string, unknown>) ?? {}
  const learning = (brandBrain.performance_learning as Record<string, unknown>) ?? {}
  const recentIdeas = (learning.recent_ideas as Array<Record<string, string>>) ?? []
  const topPerforming = (learning.top_performing as Record<string, string>) ?? {}

  return `Eres el experto en contenido de ${id.business_name ?? 'este negocio'}.

NEGOCIO:
${id.one_liner ?? ''}
${id.unique_value_proposition ?? ''}
Sector: ${id.sector ?? ''} — ${id.subsector ?? ''}
Posicionamiento: ${id.price_tier ?? ''}

AUDIENCIA:
${primary.lifestyle ?? ''}
Sienten antes: ${primary.pain_before ?? ''}
Quieren: ${primary.desire ?? ''}
Después de la experiencia: ${primary.transformation ?? ''}
Cómo hablan: ${primary.how_they_talk ?? ''}

VOZ Y TONO:
Personalidad: ${((voice.personality_traits as string[]) ?? []).join(', ')}
Formalidad: ${voice.formality_level ?? 3}/5
Emojis: ${voice.emoji_usage ?? 'minimal'}
Idioma principal: ${voice.primary_language ?? 'es'}

PALABRAS PROHIBIDAS: ${((voice.forbidden_words as string[]) ?? []).join(', ')}
TEMAS PROHIBIDOS: ${((voice.forbidden_topics as string[]) ?? []).join(', ')}
PALABRAS PREFERIDAS: ${((voice.preferred_words as string[]) ?? []).join(', ')}
ANTI-TONO: ${voice.anti_tone ?? ''}

DIFERENCIADORES CLAVE:
${((competitive.key_differentiators as string[]) ?? []).join('\n')}

IDEAS RECIENTES (NO repetir estos conceptos ni ángulos):
${recentIdeas
  .filter((i) => i.status !== 'discarded')
  .slice(0, 30)
  .map((i) => `- [${i.format}] ${i.concept} (ángulo: ${i.angle})`)
  .join('\n')}

QUÉ FUNCIONA MEJOR:
${topPerforming.best_content_type ?? 'Por determinar'}
Mejor formato: ${topPerforming.best_format ?? 'Por determinar'}

Genera contenido que suene exactamente como ${id.business_name ?? 'este negocio'}.
Nunca genérico. Nunca repetido. Siempre con intención clara.`
}

interface IdeaDraft {
  concept: string
  full_description: string
  content_type: 'reel' | 'post' | 'story' | 'carrusel'
  angle: string
  content_pillar?: string
  content_origin: 'system' | 'human'
  human_input?: string
}

interface GeneratedIdeas {
  system_ideas: IdeaDraft[]
  human_ideas: IdeaDraft[]
}

export async function generateWeeklyIdeas(
  brandBrain: Record<string, unknown>,
  recentIdeas: Array<Record<string, unknown>>,
  weekContext: string
): Promise<GeneratedIdeas> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system: buildSystemPrompt({ ...brandBrain, performance_learning: { ...((brandBrain.performance_learning as Record<string, unknown>) ?? {}), recent_ideas: recentIdeas } }),
    messages: [
      {
        role: 'user',
        content: `Genera el plan de contenido para la semana. ${weekContext}

GENERA:
5 ideas SISTEMA (content_origin: "system"):
  - Varía los tipos: mezcla product_hero, social_proof, educational, behind_scenes
  - Para cada idea: concept (1 línea) + full_description + content_type + angle + content_pillar

2 ideas HUMANO (content_origin: "human"):
  - Sugiere el ÁNGULO Y FORMATO, no el contenido
  - El humano aportará la historia real

Responde SOLO en JSON válido, sin markdown ni explicaciones extra:
{
  "system_ideas": [{"concept":"","full_description":"","content_type":"reel|post|story|carrusel","angle":"","content_pillar":"","content_origin":"system"}],
  "human_ideas": [{"concept":"","full_description":"","content_type":"reel|post|story|carrusel","angle":"","content_origin":"human","human_input":""}]
}`,
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
  return JSON.parse(text) as GeneratedIdeas
}

export async function generateCopyOptions(
  brandBrain: Record<string, unknown>,
  idea: Record<string, unknown>
): Promise<{ copy: string; hashtags: string[]; cta: string }[]> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    system: buildSystemPrompt(brandBrain),
    messages: [
      {
        role: 'user',
        content: `Genera 3 opciones de copy para esta idea de contenido:
Concepto: ${idea.concept}
Descripción: ${idea.full_description}
Tipo: ${idea.content_type}
Ángulo: ${idea.angle}

Para cada opción incluye copy completo (caption) + hashtags (array) + CTA.
Responde SOLO en JSON: [{"copy":"","hashtags":[],"cta":""}]`,
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '[]'
  return JSON.parse(text)
}

export async function generateBriefs(
  brandBrain: Record<string, unknown>,
  idea: Record<string, unknown>
): Promise<{
  recording_brief: Record<string, unknown>
  editing_brief: Record<string, unknown>
}> {
  const visual = (brandBrain.visual_identity as Record<string, unknown>) ?? {}
  const onCamera = (visual.on_camera as Record<string, unknown>) ?? {}
  const music = (visual.music_style as Record<string, unknown>) ?? {}
  const photo = (visual.photo_style as Record<string, unknown>) ?? {}

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system: buildSystemPrompt(brandBrain),
    messages: [
      {
        role: 'user',
        content: `Genera los briefs de grabación y edición para esta tarea de contenido.

IDEA:
Concepto: ${idea.concept}
Descripción: ${idea.full_description}
Tipo: ${idea.content_type}
Ángulo: ${idea.angle}

CONTEXTO VISUAL:
Puede salir en cámara: ${onCamera.owner_willing ? 'Sí (dueño)' : 'No'}${onCamera.staff_willing ? ', equipo' : ''}
Estilo música: ${((music.preferred as string[]) ?? []).join(', ') || 'sin preferencia'} (energía: ${music.energy ?? 'moderate'})
Estilo foto: ${photo.mood ?? ''}

Genera un JSON con:
{
  "recording_brief": {
    "concept": "descripción del concepto visual en 1 frase",
    "objective": "objetivo comunicativo del vídeo",
    "planes": ["plano 1", "plano 2", ...],
    "duracion_estimada": "X-Y segundos de material bruto",
    "preparacion": ["elemento 1", "elemento 2", ...],
    "musica_referencia": "estilo o canción de referencia",
    "referencia_visual": "descripción de referencia visual o cuenta IG",
    "notas_tecnicas": "instrucciones técnicas de grabación"
  },
  "editing_brief": {
    "duracion_final": "X-Y segundos",
    "ritmo": "descripción del ritmo de edición",
    "transiciones": "tipo de transiciones",
    "texto_pantalla": "texto en pantalla si aplica o null",
    "tipografia": "estilo tipográfico o null",
    "musica_exacta": "pista o descripción exacta",
    "color_grade": "instrucciones de color",
    "formato_exportacion": "specs técnicas de exportación",
    "notas_especiales": "cualquier nota adicional"
  }
}

Responde SOLO en JSON válido.`,
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
  return JSON.parse(text)
}

export async function generateReviewResponse(
  brandBrain: Record<string, unknown>,
  review: { author_name: string; rating: number; text: string }
): Promise<string[]> {
  const voice = (brandBrain.voice as Record<string, unknown>) ?? {}
  const ops = (brandBrain.operations as Record<string, unknown>) ?? {}
  const reviewTone = (ops.booking as Record<string, string>)?.booking_cta ?? 'cercano y profesional'

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 600,
    system: buildSystemPrompt(brandBrain),
    messages: [
      {
        role: 'user',
        content: `Responde a esta reseña con el tono de la marca: ${reviewTone}
Personalidad de marca: ${((voice.personality_traits as string[]) ?? []).join(', ')}

RESEÑA de ${review.author_name} (${review.rating}/5 estrellas):
"${review.text}"

Genera 2 opciones de respuesta cortas y naturales. JSON: ["respuesta1","respuesta2"]`,
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '[]'
  return JSON.parse(text)
}
