# Brand Brain — Estructura y uso en generación de contenido

El Brand Brain es el perfil estratégico completo de un cliente. Se almacena en la tabla `brand_brains` como 10 columnas JSONB. Es el input principal de **todos** los prompts de Claude — sin él, la generación es genérica; con él, suena exactamente como la marca.

Una sola fila por cliente (`UNIQUE(client_id)`).

---

## Las 10 secciones

### 1. `identity` (paso 1 del onboarding)
```json
{
  "business_name": "Nero Restaurante",
  "sector": "Restauración",
  "subsector": "Cocina italiana",
  "location": "Las Palmas de Gran Canaria",
  "one_liner": "La auténtica cocina italiana de mercado en Las Palmas",
  "unique_value_proposition": "Ingredientes importados de Italia + carta que cambia cada semana",
  "price_tier": "mid"
}
```
`price_tier` ∈ `budget | mid | premium | luxury` (enum de DB)

### 2. `audience` (paso 2)
```json
{
  "primary": {
    "age_range": "30-50",
    "occupation": "Profesionales y familias",
    "lifestyle": "Valoran la calidad sobre la cantidad",
    "pain_before": "Cansados de la comida industrial y los mismos sitios",
    "desire": "Una experiencia gastronómica auténtica sin volar a Milán",
    "transformation": "Salen sintiéndose en Italia",
    "how_they_talk": "Hablan de 'productos de calidad' y 'sabor de verdad'"
  },
  "secondary": {
    "description": "Turistas en busca de restaurante local bueno"
  }
}
```

### 3. `voice` (paso 3) — el más crítico para el tono del copy
```json
{
  "personality_traits": ["cercano", "apasionado", "honesto"],
  "formality_level": 3,
  "emoji_usage": "moderate",
  "primary_language": "es",
  "forbidden_words": ["oferta", "promoción", "barato", "chollo"],
  "forbidden_topics": ["comparaciones con competidores", "precios en posts"],
  "preferred_words": ["artesanal", "de temporada", "auténtico", "de mercado"],
  "anti_tone": "Sin hipérboles de agencia. Sin signos de exclamación en exceso."
}
```
`formality_level`: 1=muy informal, 5=muy formal
`emoji_usage`: `none | minimal | moderate | heavy`

### 4. `products` (paso 4)
```json
{
  "hero_items": [
    {
      "name": "Cacio e Pepe",
      "description": "La receta clásica romana, pecorino importado",
      "price": "16€",
      "why_special": "Hacemos la pasta en casa cada mañana",
      "content_angle": "proceso de elaboración, detrás de escenas"
    }
  ],
  "dont_promote": ["menú del día", "pizzas congeladas del stock"],
  "seasonal_calendar": "Verano: pescados; Otoño: trufas y setas; Navidad: cotechino"
}
```

### 5. `content_pillars` (paso 4 también)
Array de pilares temáticos. Cada pilar define qué tipo de contenido cubre y con qué frecuencia.
```json
[
  {
    "name": "Cocina en vivo",
    "description": "El proceso de preparación del plato, lo que no se ve",
    "frequency": "2x semana",
    "examples": ["pasta fresca", "salsa casera", "el chef explica"]
  },
  {
    "name": "Ingredientes",
    "description": "Historia y origen de los productos importados",
    "frequency": "1x semana",
    "examples": ["el pecorino de Roma", "el aceite de Sicilia"]
  }
]
```

### 6. `platforms` (paso 2 + config)
```json
{
  "instagram": {
    "enabled": true,
    "strategy": "Reels cortos del proceso + carruseles de ingredientes"
  },
  "facebook": {
    "enabled": true,
    "strategy": "Posts con contexto más largo, compartible por clientes regulares"
  },
  "tiktok": { "enabled": false },
  "gmb": {
    "enabled": true,
    "strategy": "Posts semanales sobre el menú + responder reseñas"
  }
}
```

### 7. `competitive` (paso 1)
```json
{
  "key_differentiators": [
    "Pasta elaborada en local cada mañana (nadie más en Las Palmas lo hace)",
    "Carta que cambia con el mercado (no la misma desde 2010)",
    "El chef es italiano y cocina él mismo"
  ],
  "inspiration_accounts": ["@laspastasderoma", "@cucinaitalianaverace"],
  "avoid_copying": "No queremos parecer cadena ni fast casual"
}
```

### 8. `visual_identity` (paso 5)
```json
{
  "color_palette": {
    "primary": "#1a1a1a",
    "secondary": "#f5f0e8",
    "accent": "#c8a96e",
    "avoid": ["rojo agresivo", "amarillo neón"]
  },
  "photography": {
    "mood": "Cálido, íntimo, detalle",
    "lighting": "Luz natural lateral o vela, nunca flash directo",
    "color_grade": "Tonos cálidos, ligeramente desaturados"
  },
  "music_style": "Jazz italiano suave, bossa nova",
  "on_camera": {
    "owner_willing": true,
    "staff_willing": true,
    "avoid_showing": ["el almacén", "la basura", "móviles del personal"]
  }
}
```

### 9. `operations` (paso 6)
```json
{
  "weekly_schedule": "Mar-Dom 13:00-16:00 y 20:30-23:30",
  "booking": {
    "whatsapp": "+34600123456",
    "phone": "+34928123456",
    "email": "reservas@nero.com",
    "cta": "Reserva por WhatsApp"
  },
  "social_goals": {
    "primary": "Llenar mesas en horario de cena entre semana",
    "secondary": "Construir comunidad de foodies locales"
  },
  "important_context": "Cerrado los lunes. No hay aparcamiento propio.",
  "client_notes": "Al dueño le gusta salir en vídeo pero prefiere no hablar en cámara"
}
```

### 10. `performance_learning` (actualizado automáticamente)
```json
{
  "recent_ideas": [
    { "format": "reel", "concept": "pasta cacio e pepe en 30 segundos", "angle": "humor", "status": "published" }
  ],
  "top_performing": {
    "best_content_type": "reel",
    "best_format": "behind-the-scenes"
  },
  "highlights": [
    { "content_type": "reel", "angle": "detras_escenas", "concept": "el chef explica el truco del cacio e pepe" }
  ],
  "winning_patterns": []
}
```
Este campo lo actualiza la app al publicar y al detectar winners. NO lo edites manualmente.

---

## Cómo lo usa `buildSystemPrompt()`

La función en `src/lib/claude/index.ts` construye el system prompt inyectando:

1. **`identity`** → nombre del negocio, one-liner, UVP, sector, precio
2. **`audience.primary`** → lifestyle, pain_before, desire, transformation, how_they_talk
3. **`voice`** → personality_traits, formality_level, emoji_usage, forbidden_words, forbidden_topics, preferred_words, anti_tone
4. **`competitive.key_differentiators`** → diferenciadores clave
5. **`performance_learning.recent_ideas`** → últimas 30 ideas (para no repetir)
6. **`performance_learning.top_performing`** + `highlights` → qué ha funcionado
7. **Winning patterns** → inyectados por `formatWinningPatterns()` con instrucciones de uso

Si una sección está vacía (`{}`), Claude degrada gracefully — omite esa parte del prompt y trabaja con lo que hay. El resultado será menos personalizado pero no romperá.

---

## Cómo inyectan los winning patterns

La RPC `get_winning_patterns_for_prompt(client_id, limit=10)` devuelve los patrones activos más recientes y con mayor impacto, ordenados por score = `recencia × impact_multiplier`.

Claude recibe algo como:
```
PATRONES QUE HAN FUNCIONADO PARA ESTE CLIENTE:
1. [reel · humor · instagram]
  Gancho que funcionó: "¿Sabes cuál es el truco del cacio e pepe?"
  Concepto: chef revela el secreto del pecorino
  Cuándo: saturday 20h
  Por qué funcionó (admin): La pregunta en el hook genera curiosidad + el chef es carismático
  Impacto: ×2.3 sobre baseline · hace 8d
```

Las instrucciones que acompañan son explícitas: *inspirarse en el gancho y el ángulo, nunca copiar literalmente; si el patrón tiene menos de 7 días, evitar repetir el mismo concepto.*

---

## Onboarding: los 6 pasos

| Paso | Sección de Brand Brain | Componente |
|------|----------------------|------------|
| 1 | `identity` + `competitive` | `Step1Identity.tsx` |
| 2 | `audience` + `platforms` | `Step2Audience.tsx` |
| 3 | `voice` | `Step3Voice.tsx` |
| 4 | `products` + `content_pillars` | `Step4Products.tsx` |
| 5 | `visual_identity` | `Step5Visual.tsx` |
| 6 | `operations` | `Step6Operations.tsx` |

Cada paso guarda automáticamente (debounced 1500ms) via Server Action `saveBrandBrainSection(clientId, section, data)` en `src/app/(admin)/admin/clients/[id]/brand-brain/actions.ts`.

El campo `brand_brains.onboarding_step` (1-6) controla el progreso. `onboarding_completed = true` cuando el cliente o el admin completa el paso 6.

Si el cliente accede al portal con `onboarding_completed = false`, la ruta `/cliente/onboarding` se fuerza automáticamente.

---

## Añadir una nueva sección al Brand Brain

1. Añade el campo como columna JSONB nueva en una migration (`ALTER TABLE brand_brains ADD COLUMN IF NOT EXISTS nueva_seccion JSONB DEFAULT '{}'`)
2. Crea el Step correspondiente en `src/components/brand-brain/steps/`
3. Registra la sección en `BrandBrainForm.tsx`
4. Añade el campo en `buildSystemPrompt()` si Claude debe usarlo
5. Documenta el shape JSON aquí
6. Crea ADR en `docs/decisions.md` si el cambio afecta al modelo de datos
