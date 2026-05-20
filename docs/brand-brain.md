# Brand Brain — Especificación Completa

El Brand Brain es la ficha maestra de cada cliente. Alimenta todos los prompts de Claude y garantiza que el contenido generado nunca suene genérico ni se repita. Cada campo tiene un propósito directo en la generación de contenido.

---

## Estructura de datos en Supabase

Tabla principal: `brand_brains`
Referencia: `clients.id`
Formato: JSONB por sección + campos indexados para búsqueda

---

## SECCIÓN 1 — Identidad del negocio

```typescript
identity: {
  // Básicos
  business_name: string                    // "Nero Restaurante"
  trade_name: string | null                // Nombre comercial si difiere
  sector: string                           // "Restauración", "Hostelería", "Retail"...
  subsector: string                        // "Restaurante gourmet", "Bar de tapas"...
  location_city: string                    // "Salamanca"
  location_neighborhood: string | null     // "Plaza Mayor", "Van Dyck"
  founded_year: number | null              // 2018
  founding_story: string | null            // Historia de por qué nació el negocio

  // Propuesta de valor
  one_liner: string                        // Qué hace en 1 línea, sin adornos
  unique_value_proposition: string         // Por qué existen, qué hacen diferente
  mission: string | null                   // Misión declarada (si la tienen)

  // Posicionamiento de precio
  price_tier: 'budget' | 'mid' | 'premium' | 'luxury'
  price_context: string                    // "Menú del día 12€, carta media 35€"

  // Tamaño y estructura
  team_size: string | null                 // "5 personas", "25 en temporada"
  has_physical_location: boolean
  has_online_sales: boolean
  locations_count: number                  // Si tiene varios locales
}
```

---

## SECCIÓN 2 — Audiencia objetivo

```typescript
audience: {
  // Perfil primario
  primary: {
    age_range: string                      // "25-40"
    gender_focus: 'male' | 'female' | 'mixed'
    occupation: string                     // "Profesionales, turistas de nivel medio-alto"
    lifestyle: string                      // Cómo es su vida, qué valoran
    income_level: 'low' | 'mid' | 'high' | 'very_high'
    location_type: 'local' | 'tourist' | 'mixed'

    // Psicografía — esto alimenta el tono de Claude
    pain_before: string                    // Qué sienten ANTES de encontrar este negocio
    desire: string                         // Qué quieren conseguir
    fear: string                           // Qué les preocupa (precio, calidad, experiencia)
    transformation: string                 // Cómo se sienten DESPUÉS de la experiencia

    // Lenguaje del cliente — Claude usa estas palabras
    how_they_talk: string                  // Cómo habla este cliente, qué palabras usa
    what_they_search: string              // Qué buscan en Google/IG para encontrarnos
  }

  // Perfil secundario (opcional)
  secondary: {
    description: string
    why_different_approach: string
  } | null

  // Lo que el cliente NUNCA diría de este negocio
  never_says: string[]                     // ["Es caro", "No hay sitio", "Tarda mucho"]

  // Lo que el cliente SÍ dice (testimonios reales o aproximados)
  they_say: string[]                       // ["La mejor terraza de Salamanca", "Imprescindible"]
}
```

---

## SECCIÓN 3 — Voz y tono

```typescript
voice: {
  // Personalidad de marca (adjetivos que definen cómo habla)
  personality_traits: string[]             // máx 5: ["elegante", "cercano", "directo"]

  // Escala de formalidad
  formality_level: 1 | 2 | 3 | 4 | 5    // 1=muy informal, 5=muy formal

  // Emojis
  emoji_usage: 'none' | 'minimal' | 'moderate' | 'frequent'
  emoji_style: string | null              // "Solo gastronómicos: 🍷🥩" 

  // Humor
  humor_allowed: boolean
  humor_type: string | null              // "Sutil, nunca sarcástico"

  // Idiomas
  primary_language: string               // "es"
  secondary_languages: string[]          // ["en", "de"] para turistas

  // Palabras y expresiones PROHIBIDAS
  forbidden_words: string[]              // ["barato", "económico", "asequible", "mega"]
  forbidden_topics: string[]             // ["política", "competidores por nombre", "precios en copy"]

  // Palabras y expresiones que SÍ usar
  preferred_words: string[]              // ["experiencia", "producto", "temporada"]
  signature_expressions: string[]        // Frases que ya usan y funcionan

  // Marcas o cuentas cuyo tono se parece al objetivo
  tone_references: string[]              // ["@DiverXO", "@StreetXO"] como referencia de tono

  // Cómo NO sonar nunca
  anti_tone: string                      // "No sonar como un menú impreso. No ser frío."
}
```

---

## SECCIÓN 4 — Productos y servicios

```typescript
products: {
  // Productos/platos/servicios estrella
  hero_items: Array<{
    name: string                           // "Entrecot de vaca rubia gallega"
    description: string                    // Descripción para copy
    price: string | null                   // "28€" o null si no se comunica precio
    why_special: string                    // Por qué es diferente o por qué pedir esto
    season: string | null                  // "Todo el año" | "Solo en verano"
    visual_description: string             // Cómo es visualmente para el grabador
    content_angle: string                  // Mejor ángulo de contenido para este plato
  }>

  // Servicios especiales
  special_services: Array<{
    name: string                           // "Eventos privados hasta 60 personas"
    description: string
    target: string                         // A quién va dirigido
    cta: string                            // Call to action específico
  }>

  // Qué NO ofrecer / qué no comunicar
  dont_promote: string[]                   // ["El menú del día", "Precios sin contexto"]

  // Temporalidad
  seasonal_calendar: Array<{
    period: string                         // "Semana Santa", "Verano", "Navidad"
    months: number[]                       // [3, 4] para marzo-abril
    content_focus: string                  // Qué comunicar en este período
    special_offers: string | null
  }>
}
```

---

## SECCIÓN 5 — Pilares de contenido

```typescript
content_pillars: Array<{
  name: string                             // "La experiencia Nero"
  description: string                      // Qué engloba este pilar
  content_types: string[]                  // Qué tipo de contenido encaja
  frequency: string                        // "2 veces por semana"
  examples: string[]                       // 2-3 ejemplos de ideas para este pilar
  human_or_system: 'human' | 'system' | 'both'
}>

// Ejemplo para Nero:
// [
//   {
//     name: "La experiencia",
//     description: "Mostrar cómo es estar en Nero: terraza, ambiente, servicio",
//     content_types: ["Reel ambiente", "Story atardecer", "Foto editorial"],
//     frequency: "3x semana",
//     examples: ["Terraza al atardecer", "Mesa montada para evento", "Apertura de cocina"],
//     human_or_system: "both"
//   },
//   {
//     name: "El producto",
//     description: "Platos y bebidas con protagonismo visual",
//     content_types: ["Reel plano cenital", "Foto editorial", "Reel proceso cocina"],
//     frequency: "2x semana",
//     examples: ["Emplatado del entrecot", "Cóctel de temporada", "Postre en primer plano"],
//     human_or_system: "system"
//   }
// ]
```

---

## SECCIÓN 6 — Estrategia por plataforma

```typescript
platforms: {
  instagram: {
    active: boolean
    handle: string                         // "@nerosalamanca"
    meta_page_id: string                   // ID de página de Facebook vinculada
    meta_ig_account_id: string             // ID de cuenta IG en Meta
    primary_goal: string                   // "Branding y reservas"
    best_times: string[]                   // ["19:00-21:00", "12:00-13:00"]
    feed_frequency: number                 // Posts por semana
    stories_frequency: number              // Stories por día
    reels_frequency: number                // Reels por semana
    content_mix: string                    // "60% producto, 30% ambiente, 10% behind the scenes"
    hashtag_sets: {
      primary: string[]                    // 5-8 hashtags de nicho
      secondary: string[]                  // 5-8 hashtags de ubicación
      tertiary: string[]                   // 3-5 hashtags de tendencia/temporada
    }
  }
  facebook: {
    active: boolean
    page_id: string
    strategy: string                       // "Espejo de IG con copy adaptado a audiencia mayor"
    boost_posts: boolean                   // Si se hacen promociones
  }
  tiktok: {
    active: boolean
    handle: string | null
    content_style: string | null           // "Más informal que IG, trends de gastronomía"
  }
  google_my_business: {
    active: boolean
    location_id: string | null
    post_frequency: string                 // "Semanal"
    review_response_tone: string           // Tono para responder reseñas
  }
}
```

---

## SECCIÓN 7 — Competencia y referencias

```typescript
competitive: {
  // Competidores directos
  competitors: Array<{
    name: string
    handle: string | null
    what_they_do_well: string             // Para no hacer lo mismo
    what_they_do_poorly: string           // Oportunidad para diferenciarse
    never_copy: string                    // Qué nunca replicar
  }>

  // Cuentas de inspiración (no competidores, referencia estética/tonal)
  inspiration_accounts: Array<{
    handle: string
    why_inspiring: string                 // Qué se puede aprender de ellos
    what_to_adapt: string                 // Qué adaptar al estilo propio
  }>

  // Diferenciación clara
  key_differentiators: string[]          // Qué hace único a este cliente vs todos los demás
  positioning_statement: string          // En 1-2 frases, cómo se posiciona
}
```

---

## SECCIÓN 8 — Identidad visual (para el grabador y editor)

```typescript
visual_identity: {
  // Paleta de colores
  colors: {
    primary: string                        // "#1A1A1A" o descripción: "Negro mate"
    secondary: string                      // "#C9A84C" o "Dorado"
    accent: string | null
    background: string                     // "Tonos oscuros y tierra"
    avoid: string[]                        // Colores a evitar: ["Neón", "Azul brillante"]
  }

  // Tipografía (referencia para el editor)
  typography: {
    style: string                          // "Serif elegante para títulos, sans para body"
    feel: string                           // "Sofisticado, legible, sin florituras"
    avoid: string                          // "No Comic Sans, no tipografías decorativas"
  }

  // Estética fotográfica
  photo_style: {
    mood: string                           // "Cálido, íntimo, con luz natural o vela"
    lighting: string                       // "Natural preferiblemente, golden hour"
    color_grade: string                    // "Tonos cálidos, ligeramente desaturados"
    composition: string                    // "Regla de tercios, espacio negativo"
    avoid: string[]                        // ["Fondo blanco de estudio", "Filtros exagerados"]
  }

  // Referencias visuales
  visual_references: string[]             // Links o cuentas de referencia estética

  // Música (para reels y vídeos)
  music_style: {
    preferred: string[]                    // ["Jazz suave", "Lo-fi", "Acústico elegante"]
    avoid: string[]                        // ["Reggaeton", "Música muy agresiva"]
    energy: 'calm' | 'moderate' | 'energetic'
  }

  // Quién puede aparecer en cámara
  on_camera: {
    owner_willing: boolean                 // ¿El dueño/a quiere salir?
    owner_name: string | null
    staff_willing: boolean                 // ¿El equipo puede salir?
    staff_notes: string | null             // "Solo el chef y los camareros fijos"
    avoid_showing: string[]               // "No mostrar cocina en obras", "No al encargado X"
  }
}
```

---

## SECCIÓN 9 — Contexto operativo

```typescript
operations: {
  // Horarios del negocio
  schedule: {
    monday: string | null                  // "13:00-16:00, 20:00-24:00" o null si cerrado
    tuesday: string | null
    wednesday: string | null
    thursday: string | null
    friday: string | null
    saturday: string | null
    sunday: string | null
    special_notes: string | null          // "En agosto cierra los lunes"
  }

  // Cómo contactar / reservar
  booking: {
    accepts_reservations: boolean
    booking_method: string[]              // ["Teléfono", "TheFork", "Email"]
    booking_cta: string                   // Frase exacta para el CTA de reservas
    whatsapp: string | null
    phone: string | null
    email: string | null
  }

  // Objetivos de redes sociales (lo que el cliente quiere conseguir)
  social_goals: {
    primary: string                        // "Aumentar reservas para eventos privados"
    secondary: string                      // "Posicionarse como referente gastronómico en Salamanca"
    kpis: string[]                         // ["Reservas atribuidas", "Seguidores", "Reach mensual"]
    current_followers: Record<string, number>  // {"instagram": 2400, "facebook": 890}
    follower_goal_6m: Record<string, number>
  }

  // Contexto adicional que Claude debe conocer
  important_context: string              // Info relevante que no encaja en otra sección
  content_restrictions: string[]        // Restricciones específicas del cliente
  client_notes: string                  // Notas internas (no se muestran al cliente)
}
```

---

## SECCIÓN 10 — Aprendizaje y retroalimentación (auto-actualizado)

Esta sección la actualiza el sistema automáticamente después de cada ciclo de analytics.

```typescript
performance_learning: {
  // Últimas 30 ideas generadas (para evitar repetición)
  recent_ideas: Array<{
    id: string
    concept: string                        // Concepto central en 1 línea
    format: string                         // "reel" | "post" | "story" | "carrusel"
    angle: string                          // "emocional" | "informativo" | "humor" | "social_proof"
    generated_at: string
    status: 'suggested' | 'approved' | 'recorded' | 'published' | 'discarded'
    performance: {
      reach: number | null
      likes: number | null
      saves: number | null
      comments: number | null
    } | null
  }>

  // Qué funciona mejor (actualizado automáticamente)
  top_performing: {
    best_format: string                    // "Reels de terraza funcionan 3x mejor"
    best_time: string                      // "Jueves 19:00-20:00"
    best_content_type: string             // "Producto con contexto de experiencia"
    avg_engagement_rate: number           // 0.042 = 4.2%
    best_hashtag_set: string[]
  }

  // Qué no ha funcionado
  underperforming: {
    weak_formats: string[]
    weak_times: string[]
    weak_content_types: string[]
  }

  last_updated: string                    // ISO timestamp
}
```

---

## System Prompt de Claude para este cliente

Cuando el sistema llama a Claude para generar contenido, construye el system prompt así:

```typescript
function buildSystemPrompt(brandBrain: BrandBrain): string {
  return `
Eres el experto en contenido de ${brandBrain.identity.business_name}.

NEGOCIO:
${brandBrain.identity.one_liner}
${brandBrain.identity.unique_value_proposition}
Sector: ${brandBrain.identity.sector} — ${brandBrain.identity.subsector}
Posicionamiento: ${brandBrain.identity.price_tier}

AUDIENCIA:
${brandBrain.audience.primary.lifestyle}
Sienten antes: ${brandBrain.audience.primary.pain_before}
Quieren: ${brandBrain.audience.primary.desire}
Después de la experiencia: ${brandBrain.audience.primary.transformation}
Cómo hablan: ${brandBrain.audience.primary.how_they_talk}

VOZ Y TONO:
Personalidad: ${brandBrain.voice.personality_traits.join(', ')}
Formalidad: ${brandBrain.voice.formality_level}/5
Emojis: ${brandBrain.voice.emoji_usage}
Humor: ${brandBrain.voice.humor_allowed ? brandBrain.voice.humor_type : 'No'}
Idioma principal: ${brandBrain.voice.primary_language}

PALABRAS PROHIBIDAS: ${brandBrain.voice.forbidden_words.join(', ')}
TEMAS PROHIBIDOS: ${brandBrain.voice.forbidden_topics.join(', ')}
PALABRAS PREFERIDAS: ${brandBrain.voice.preferred_words.join(', ')}
ANTI-TONO: ${brandBrain.voice.anti_tone}

DIFERENCIADORES CLAVE:
${brandBrain.competitive.key_differentiators.join('\n')}

IDEAS RECIENTES (NO repetir estos conceptos ni ángulos):
${brandBrain.performance_learning.recent_ideas
  .filter(i => i.status !== 'discarded')
  .slice(0, 30)
  .map(i => `- [${i.format}] ${i.concept} (ángulo: ${i.angle})`)
  .join('\n')}

QUÉ FUNCIONA MEJOR:
${brandBrain.performance_learning.top_performing.best_content_type}
Mejor formato: ${brandBrain.performance_learning.top_performing.best_format}

Genera contenido que suene exactamente como ${brandBrain.identity.business_name}.
Nunca genérico. Nunca repetido. Siempre con intención clara.
  `
}
```

---

## Formulario de onboarding

El formulario de onboarding del cliente rellena este Brand Brain. Está dividido en pasos para no agobiar:

- **Paso 1:** Identidad básica (5 min)
- **Paso 2:** Audiencia y tono (5 min)
- **Paso 3:** Productos estrella (5 min)
- **Paso 4:** Plataformas y competencia (5 min)
- **Paso 5:** Identidad visual + quién puede grabar (5 min)
- **Paso 6:** Objetivos y contexto operativo (3 min)

Total estimado: 23-30 min. El cliente puede pausar y continuar. Al completarlo, se genera automáticamente la primera sesión de ideas.

---

## Reglas de generación de ideas (anti-repetición)

Antes de cada generación, el sistema:

1. Extrae los últimos 30 `recent_ideas` del cliente
2. Agrupa por `concept` + `angle` 
3. Pasa el listado a Claude en el system prompt
4. Claude tiene instrucción explícita: *"No uses ningún concepto, ángulo o formato de esta lista. Sé radicalmente diferente."*
5. Cada idea nueva generada se guarda inmediatamente en `recent_ideas`
6. Ideas con status `discarded` no se bloquean para siempre — después de 60 días se pueden reciclar

---

## Tipos de ideas que el sistema genera

### Ideas SISTEMA (generación automática)

| Tipo | Descripción | Frecuencia |
|---|---|---|
| `product_hero` | Contenido de producto/plato estrella | 2x semana |
| `seasonal` | Contenido ligado a fecha o evento | Según calendario |
| `educational` | Algo que el cliente no sabía sobre el sector | 1x semana |
| `social_proof` | Reseña, testimonio, mención | 1x semana |
| `behind_scenes` | Operativa, cocina, equipo (no íntimo) | 1x semana |
| `engagement` | Story participativa (encuesta, pregunta) | Diario |
| `announcement` | Novedades, horarios, eventos | Según necesidad |

### Ideas HUMANO (sugeridas, contenido originado por persona)

| Tipo | Descripción |
|---|---|
| `founder_story` | Historia personal del dueño/fundador |
| `opinion` | Opinión sobre algo del sector |
| `real_moment` | Algo que pasó de verdad en el local |
| `lesson` | Un aprendizaje o error del negocio |
| `vision` | A dónde va el negocio, qué viene |

Las ideas HUMANO solo se sugieren — el ángulo lo aporta el humano. Claude solo estructura el guión.
