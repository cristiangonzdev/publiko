# Skill: Claude API — patrón estándar de generación

Guía para llamar a Claude API en Publiko. Toda la lógica de generación vive en `src/lib/claude/index.ts`. Lee `@docs/brand-brain.md` para entender cómo se construye el system prompt.

---

## Modelo a usar

```typescript
// SIEMPRE este modelo. Cambiar requiere ADR en docs/decisions.md.
const MODEL = 'claude-sonnet-4-6'
```

Nunca hardcodear un string de modelo distinto. Si se necesita un modelo diferente para una tarea específica, documentarlo primero.

---

## Patrón estándar de llamada

```typescript
import Anthropic from '@anthropic-ai/sdk'
import { buildSystemPrompt } from '@/lib/claude'

const client = new Anthropic()  // usa ANTHROPIC_API_KEY del env automáticamente

async function generateSomething(brandBrain: Record<string, unknown>, input: string) {
  const systemPrompt = buildSystemPrompt(brandBrain)

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `${input}\n\nResponde ÚNICAMENTE con JSON válido, sin texto adicional, sin markdown.`
      }
    ]
  })

  const rawText = message.content[0].type === 'text' ? message.content[0].text : ''
  const cleaned = stripMarkdown(rawText)  // ← SIEMPRE antes de JSON.parse

  try {
    return JSON.parse(cleaned)
  } catch (e) {
    throw new Error(`Claude devolvió JSON inválido: ${cleaned.slice(0, 200)}`)
  }
}
```

---

## `stripMarkdown()` — siempre antes de JSON.parse

Claude a veces envuelve el JSON en triple backtick aunque se le pida que no. `stripMarkdown` elimina esos wrappers:

```typescript
function stripMarkdown(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
}
```

Esta función está exportada desde `src/lib/claude/index.ts`. **Nunca llamar `JSON.parse()` directamente sobre la respuesta de Claude sin pasar por `stripMarkdown()`.**

---

## Cómo cargar el Brand Brain antes de llamar a Claude

```typescript
import { createServiceClient } from '@/lib/supabase/server'

async function getBrandBrain(clientId: string) {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('brand_brains')
    .select('*')
    .eq('client_id', clientId)
    .single()

  if (error || !data) throw new Error(`Brand Brain no encontrado para cliente ${clientId}`)
  return data
}
```

---

## Inyectar winning patterns en el prompt

Los winning patterns se inyectan via RPC antes de llamar a `buildSystemPrompt()`:

```typescript
const supabase = createServiceClient()
const { data: patterns } = await supabase
  .rpc('get_winning_patterns_for_prompt', { p_client_id: clientId, p_limit: 10 })

// Añadir patterns al brandBrain antes de construir el prompt
const brandBrainWithPatterns = {
  ...brandBrain,
  performance_learning: {
    ...brandBrain.performance_learning,
    winning_patterns: patterns ?? []
  }
}
const systemPrompt = buildSystemPrompt(brandBrainWithPatterns)
```

---

## Manejo de errores

### Timeout
Las llamadas a Claude pueden tardar 15-30s para generaciones complejas. En API routes de Next.js, añadir `export const maxDuration = 60` para evitar que Vercel corte la request.

```typescript
// Al inicio de la API route
export const maxDuration = 60  // segundos
```

### Rate limit
Si Claude devuelve 429, es raro pero posible. Manejar con retry:
```typescript
let attempts = 0
while (attempts < 3) {
  try {
    return await client.messages.create(...)
  } catch (e: any) {
    if (e.status === 429 && attempts < 2) {
      await new Promise(r => setTimeout(r, 2000 * (attempts + 1)))
      attempts++
      continue
    }
    throw e
  }
}
```

### JSON malformado
Si Claude devuelve algo que no es JSON tras `stripMarkdown()`, loguear el texto completo para debug:
```typescript
try {
  return JSON.parse(cleaned)
} catch {
  console.error('[Claude] JSON parse failed. Raw response:', rawText)
  throw new Error('Respuesta de Claude no es JSON válido')
}
```

---

## Las 8 funciones disponibles en `src/lib/claude/index.ts`

| Función | Input | Output | max_tokens |
|---------|-------|--------|-----------|
| `buildSystemPrompt(brandBrain)` | Brand Brain completo | string | — |
| `generateWeeklyIdeas(brandBrain, recentIdeas, weekContext)` | Brand Brain + contexto | `{system_ideas[], human_ideas[]}` | 2000 |
| `generateDailyBatch(brandBrain, recentIdeas, config, dateLabel)` | Brand Brain + config | `DailyIdeaDraft[]` | 2500 |
| `generateCopyOptions(brandBrain, idea)` | Brand Brain + idea | `[{copy, hashtags[], cta}]` × 3 | 1500 |
| `generateCopiesPerPlatform(brandBrain, idea, platforms)` | Brand Brain + idea + platforms | `{instagram?, facebook?, tiktok?, gmb?}` | 2000 |
| `generateBriefs(brandBrain, idea)` | Brand Brain + idea | `{recording_brief, editing_brief}` | 2000 |
| `judgeContent(brandBrain, payload)` | Brand Brain + copy | `{passes, score, issues[], reasoning}` | 800 |
| `generateReviewResponse(brandBrain, review)` | Brand Brain + review | `[respuesta1, respuesta2]` | 600 |

---

## Validar output con Zod

Para funciones nuevas, definir el schema de output con Zod antes de parsear:

```typescript
import { z } from 'zod'

const IdeaSchema = z.object({
  concept: z.string().min(1),
  content_type: z.enum(['reel', 'post', 'story', 'carrusel', 'gmb_post']),
  angle: z.enum(['emocional', 'informativo', 'humor', 'social_proof', 'educativo',
                  'aspiracional', 'detras_escenas', 'anuncio', 'opinion', 'historia']),
  approval_tier: z.enum(['auto', 'manual'])
})

const parsed = IdeaSchema.safeParse(JSON.parse(cleaned))
if (!parsed.success) {
  console.error('[Claude] Schema mismatch:', parsed.error.flatten())
  throw new Error('Respuesta de Claude no coincide con el schema esperado')
}
return parsed.data
```

---

## Sanitizar enums antes de INSERT

Claude puede devolver valores de enum fuera del conjunto válido (ej. `'cancelled'` cuando no existe en DB). Siempre sanitizar:

```typescript
const VALID_ANGLES = ['emocional', 'informativo', 'humor', 'social_proof', 'educativo',
                       'aspiracional', 'detras_escenas', 'anuncio', 'opinion', 'historia'] as const

const safeAngle = VALID_ANGLES.includes(idea.angle as any)
  ? idea.angle
  : 'informativo'  // fallback seguro
```
