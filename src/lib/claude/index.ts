import Anthropic from '@anthropic-ai/sdk'
import type { FewShotExample } from '@/lib/winning-patterns/examples'

export type { FewShotExample }

const client = new Anthropic()

function stripMarkdown(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
}

export interface WinningPatternForPrompt {
  source: 'auto' | 'manual' | 'hybrid'
  features: {
    content_type?: string | null
    angle?: string | null
    platform?: string | null
    hook?: string | null
    concept_summary?: string | null
    publish_hour?: string | null
    weekday?: string | null
    has_cta?: boolean | null
    copy_excerpt?: string | null
  }
  reason: string | null
  impact_multiplier: number | null
  metrics: { engagement_rate?: number | null; reach?: number | null }
  days_ago: number
}

function formatWinningPatterns(patterns: WinningPatternForPrompt[]): string {
  if (patterns.length === 0) return ''

  const lines = patterns.map((p, i) => {
    const f = p.features ?? {}
    const parts: string[] = []
    parts.push(`${i + 1}. [${f.content_type ?? '?'} · ${f.angle ?? '?'}${f.platform ? ' · ' + f.platform : ''}]`)
    if (f.hook) parts.push(`  Gancho que funcionó: "${f.hook}"`)
    if (f.concept_summary) parts.push(`  Concepto: ${f.concept_summary}`)
    if (f.publish_hour || f.weekday) parts.push(`  Cuándo: ${f.weekday ?? ''} ${f.publish_hour ? f.publish_hour + 'h' : ''}`.trim())
    if (p.reason) parts.push(`  Por qué funcionó (admin): ${p.reason}`)
    if (p.impact_multiplier) parts.push(`  Impacto: ×${p.impact_multiplier.toFixed(1)} sobre baseline · hace ${p.days_ago}d`)
    else parts.push(`  Origen: ${p.source} · hace ${p.days_ago}d`)
    return parts.join('\n')
  })

  return `\nPATRONES QUE HAN FUNCIONADO PARA ESTE CLIENTE (úsalos como inspiración, NO los clones literalmente):\n${lines.join('\n\n')}\n\nReglas al usar estos patrones:\n- INSPÍRATE en el gancho, el ángulo y el formato, NUNCA copies el copy literal\n- Si un patrón es de hace menos de 7 días, EVITA repetir el mismo concept_summary\n- Si varios patrones comparten ángulo/formato, ese es el camino fuerte\n- Si el admin escribió "Por qué funcionó", esa es la señal más importante\n`
}

function buildFewShotMessages(examples: FewShotExample[]): Anthropic.MessageParam[] {
  if (examples.length === 0) return []
  const messages: Anthropic.MessageParam[] = []
  for (const ex of examples) {
    messages.push({
      role: 'user',
      content: `Genera copy para: "${ex.title}" (${ex.content_type}, ${ex.platform})`,
    })
    messages.push({
      role: 'assistant',
      content: JSON.stringify([{ copy: ex.copy, hashtags: ex.hashtags }]),
    })
  }
  return messages
}

export function buildSystemPrompt(brandBrain: Record<string, unknown>): string {
  const id = (brandBrain.identity as Record<string, string>) ?? {}
  const audience = (brandBrain.audience as Record<string, unknown>) ?? {}
  const primary = (audience.primary as Record<string, string>) ?? {}
  const voice = (brandBrain.voice as Record<string, unknown>) ?? {}
  const competitive = (brandBrain.competitive as Record<string, unknown>) ?? {}
  const learning = (brandBrain.performance_learning as Record<string, unknown>) ?? {}
  const recentIdeas = (learning.recent_ideas as Array<Record<string, string>>) ?? []
  const topPerforming = (learning.top_performing as Record<string, string>) ?? {}
  const highlights = (learning.highlights as Array<Record<string, string>>) ?? []
  const winningPatterns = (learning.winning_patterns as WinningPatternForPrompt[]) ?? []

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
Tipo de contenido: ${topPerforming.best_content_type ?? 'Por determinar'}
Ángulo ganador: ${topPerforming.best_format ?? 'Por determinar'}
${highlights.length > 0 ? `\nCONTENIDO QUE YA HA FUNCIONADO BIEN (prioriza estos patrones):\n${highlights.slice(0, 8).map((h) => `- [${h.content_type}/${h.angle}] ${h.concept}`).join('\n')}` : ''}
${formatWinningPatterns(winningPatterns)}
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
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    system: buildSystemPrompt({ ...brandBrain, performance_learning: { ...((brandBrain.performance_learning as Record<string, unknown>) ?? {}), recent_ideas: recentIdeas } }),
    messages: [
      {
        role: 'user',
        content: `Genera el plan de contenido para la semana. ${weekContext}

GENERA:
5 ideas SISTEMA (content_origin: "system"):
  - Para cada idea: concept (1 línea) + full_description + content_type + angle + content_pillar

2 ideas HUMANO (content_origin: "human"):
  - Sugiere el ángulo y formato, no el contenido. El humano aportará la historia real.

VALORES EXACTOS PERMITIDOS (usa SOLO estos, sin modificar):
- content_type: "reel" | "post" | "story" | "carrusel"
- angle: "emocional" | "informativo" | "humor" | "social_proof" | "educativo" | "aspiracional" | "detras_escenas" | "anuncio" | "opinion" | "historia"
- content_origin: "system" | "human"

Responde SOLO con JSON válido, sin markdown, sin texto extra:
{"system_ideas":[{"concept":"","full_description":"","content_type":"reel","angle":"emocional","content_pillar":"","content_origin":"system"}],"human_ideas":[{"concept":"","full_description":"","content_type":"reel","angle":"historia","content_origin":"human","human_input":""}]}`,
      },
    ],
  })

    const text = stripMarkdown(response.content[0].type === 'text' ? response.content[0].text : '{}')
  return JSON.parse(text) as GeneratedIdeas
}

export async function generateCopyOptions(
  brandBrain: Record<string, unknown>,
  idea: Record<string, unknown>,
  fewShotExamples: FewShotExample[] = [],
): Promise<{ copy: string; hashtags: string[]; cta: string }[]> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    system: buildSystemPrompt(brandBrain),
    messages: [
      ...buildFewShotMessages(fewShotExamples),
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

  const text = stripMarkdown(response.content[0].type === 'text' ? response.content[0].text : '[]')
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
    model: 'claude-sonnet-4-6',
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

  const text = stripMarkdown(response.content[0].type === 'text' ? response.content[0].text : '{}')
  return JSON.parse(text)
}

// ============================================================================
// SCALING: daily batch + per-platform copy + AI judge
// ============================================================================

export interface DailyGenerationConfig {
  reels_per_day?: number
  posts_per_day?: number
  stories_per_day?: number
  carrusels_per_day?: number
  auto_tier_content_types?: string[]   // e.g. ["story"] — these skip admin approval
  publish_hours?: string[]             // e.g. ["09:00", "14:00", "20:00"]
  platforms?: string[]                  // e.g. ["instagram", "facebook"]
}

interface DailyIdeaDraft extends IdeaDraft {
  approval_tier: 'auto' | 'manual'
  suggested_publish_time?: string      // "HH:MM"
}

export async function generateDailyBatch(
  brandBrain: Record<string, unknown>,
  recentIdeas: Array<Record<string, unknown>>,
  config: DailyGenerationConfig,
  dateLabel: string,
): Promise<DailyIdeaDraft[]> {
  const reels = config.reels_per_day ?? 0
  const posts = config.posts_per_day ?? 0
  const stories = config.stories_per_day ?? 0
  const carrusels = config.carrusels_per_day ?? 0
  const total = reels + posts + stories + carrusels
  if (total === 0) return []

  const autoTypes = config.auto_tier_content_types ?? []
  const hours = config.publish_hours ?? ['09:00', '14:00', '20:00']

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    system: buildSystemPrompt({ ...brandBrain, performance_learning: { ...((brandBrain.performance_learning as Record<string, unknown>) ?? {}), recent_ideas: recentIdeas } }),
    messages: [
      {
        role: 'user',
        content: `Genera el plan de contenido para el ${dateLabel}.

VOLUMEN OBJETIVO HOY:
- ${reels} reel${reels === 1 ? '' : 's'}
- ${posts} post${posts === 1 ? '' : 's'}
- ${stories} stor${stories === 1 ? 'y' : 'ies'}
- ${carrusels} carrusel${carrusels === 1 ? '' : 'es'}
TOTAL: ${total} piezas

Cada pieza debe ser ÚNICA y aportar algo distinto en el feed. Stories pueden ser más informales / behind-scenes; posts más estructurados; reels con hook fuerte en 3s.

VALORES EXACTOS PERMITIDOS:
- content_type: "reel" | "post" | "story" | "carrusel"
- angle: "emocional" | "informativo" | "humor" | "social_proof" | "educativo" | "aspiracional" | "detras_escenas" | "anuncio" | "opinion" | "historia"
- approval_tier: "auto" para tipos en ${JSON.stringify(autoTypes)}, "manual" para el resto. Si una pieza es delicada (oferta, anuncio, mensaje sensible), fuerza "manual" aunque su tipo esté en auto.
- suggested_publish_time: elige una hora de esta lista: ${JSON.stringify(hours)}, distribuyendo equitativamente.

Responde SOLO con JSON válido, sin markdown:
{"ideas":[{"concept":"","full_description":"","content_type":"story","angle":"detras_escenas","content_pillar":"","content_origin":"system","approval_tier":"auto","suggested_publish_time":"09:00"}]}`,
      },
    ],
  })

  const text = stripMarkdown(response.content[0].type === 'text' ? response.content[0].text : '{}')
  const parsed = JSON.parse(text) as { ideas: DailyIdeaDraft[] }
  return parsed.ideas ?? []
}

export async function generateCopiesPerPlatform(
  brandBrain: Record<string, unknown>,
  idea: Record<string, unknown>,
  platforms: string[],
  fewShotExamples: FewShotExample[] = [],
): Promise<Record<string, { copy: string; hashtags: string[]; cta: string }>> {
  if (platforms.length === 0) return {}

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    system: buildSystemPrompt(brandBrain),
    messages: [
      ...buildFewShotMessages(fewShotExamples),
      {
        role: 'user',
        content: `Genera copy adaptado a cada plataforma para esta idea:
Concepto: ${idea.concept}
Descripción: ${idea.full_description}
Tipo: ${idea.content_type}
Ángulo: ${idea.angle}

PLATAFORMAS: ${platforms.join(', ')}

Reglas por plataforma:
- instagram: tono cercano, caption rica, 5-10 hashtags relevantes (sin spam), CTA suave
- facebook: tono ligeramente más narrativo, 0-3 hashtags, CTA explícito
- tiktok: gancho fuerte primera línea, lenguaje conversacional, 3-5 hashtags + uno de tendencia si encaja, CTA con ritmo
- gmb: descriptivo y orientado a búsqueda local, sin hashtags, CTA hacia reserva/llamada

Responde SOLO con JSON válido (claves = nombres de plataforma):
${platforms.map((p) => `"${p}":{"copy":"","hashtags":[],"cta":""}`).join(',')}

JSON: {${platforms.map((p) => `"${p}":{"copy":"","hashtags":[],"cta":""}`).join(',')}}`,
      },
    ],
  })

  const text = stripMarkdown(response.content[0].type === 'text' ? response.content[0].text : '{}')
  return JSON.parse(text)
}

export interface JudgeVerdict {
  passes: boolean
  score: number          // 0..1
  issues: string[]       // empty if passes
  reasoning: string
}

export async function judgeContent(
  brandBrain: Record<string, unknown>,
  payload: {
    concept: string
    content_type: string
    copy: string
    hashtags?: string[]
    cta?: string
    kind?: 'feed' | 'story'
  },
): Promise<JudgeVerdict> {
  const voice = (brandBrain.voice as Record<string, unknown>) ?? {}
  const forbidden = ((voice.forbidden_words as string[]) ?? []).concat((voice.forbidden_topics as string[]) ?? [])
  const kind = payload.kind ?? (payload.content_type === 'story' ? 'story' : 'feed')

  const storyRules = `
CRITERIOS ESPECÍFICOS PARA STORIES (más permisivos que feed):
- Tono coloquial y cercano OK — las stories son más informales que el feed
- Copy MUY corto (≤ 80 caracteres ideal, máx 150). Si el copy es largo, rechaza.
- Hashtags: 0 ideal, máx 2. Más hashtags = spam en story → rechaza.
- CTA opcional (las stories tienen stickers de respuesta nativos)
- Emojis OK con moderación
- NUNCA aprobar stories con: precios concretos, promesas legales, descuentos sin verificar, anuncios de horario sin confirmar
- IG ignora la caption de stories de todas formas — si el copy aporta información esencial al post, debería ser feed, no story → rechaza`

  const feedRules = `
CRITERIOS DE RECHAZO (cualquiera basta):
- Faltas de ortografía o gramaticales claras
- Tono fuera de marca (genérico, robótico, demasiado formal o informal)
- Uso de palabras/temas prohibidos
- CTA confuso, ambiguo o ausente cuando hace falta
- Hashtags spam, repetidos o irrelevantes
- Contenido sensible (precios concretos, promesas legales, salud, política, religión) que necesita revisión humana
- Mención de cantidades, fechas o datos sin verificar
- Errores tipográficos o emojis fuera de estilo`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 800,
    system: `Eres un revisor de marca riguroso. Tu trabajo: detectar contenido que NO debería auto-publicarse porque viola la voz, contiene errores, o es sensible.

Marca: ${((brandBrain.identity as Record<string, string>) ?? {}).business_name ?? ''}
Voz: ${((voice.personality_traits as string[]) ?? []).join(', ')}
Anti-tono: ${voice.anti_tone ?? ''}
Palabras/temas prohibidos: ${forbidden.join(', ') || 'ninguno'}
Tipo de pieza: ${kind === 'story' ? 'STORY (efímera, 24h)' : 'FEED (permanente)'}

${kind === 'story' ? storyRules : feedRules}

Si TODO está bien y se puede publicar sin intervención: passes=true.
Si HAY UN solo problema: passes=false e indica los issues concretos.`,
    messages: [
      {
        role: 'user',
        content: `Evalúa esta pieza para auto-publicación:

Tipo: ${payload.content_type}
Concepto: ${payload.concept}

Copy:
"""
${payload.copy}
"""

Hashtags: ${(payload.hashtags ?? []).map((h) => `#${h.replace(/^#/, '')}`).join(' ') || '(ninguno)'}
CTA: ${payload.cta ?? '(ninguno)'}

Responde SOLO en JSON válido:
{"passes":true|false,"score":0.0-1.0,"issues":["..."],"reasoning":"breve explicación"}`,
      },
    ],
  })

  const text = stripMarkdown(response.content[0].type === 'text' ? response.content[0].text : '{}')
  return JSON.parse(text) as JudgeVerdict
}

export async function generateReviewResponse(
  brandBrain: Record<string, unknown>,
  review: { author_name: string; rating: number; text: string }
): Promise<string[]> {
  const voice = (brandBrain.voice as Record<string, unknown>) ?? {}
  const ops = (brandBrain.operations as Record<string, unknown>) ?? {}
  const reviewTone = (ops.booking as Record<string, string>)?.booking_cta ?? 'cercano y profesional'

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
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

  const text = stripMarkdown(response.content[0].type === 'text' ? response.content[0].text : '[]')
  return JSON.parse(text)
}
