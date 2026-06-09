# Skill: Adaptación de contenido por plataforma

Reglas para adaptar el contenido master a cada plataforma específica. La función `generateCopiesPerPlatform()` en `src/lib/claude/index.ts` implementa esto automáticamente, pero estas reglas son la fuente de verdad.

---

## Instagram

| Parámetro | Límite / Regla |
|-----------|---------------|
| Copy (caption) | 2.200 chars máx. Impactante en las primeras 2-3 líneas (se trunca con "más") |
| Hashtags | 3-15 (rendimiento óptimo). Máximo 30. Nunca incluidos en el texto principal — al final, separados |
| Aspect ratio Feed | 4:5 (1080×1350px) para fotos/carruseles |
| Aspect ratio Reels | 9:16 (1080×1920px) |
| Duración Reels | 15s-90s (óptimo: 15-30s) |
| Vídeo spec | MP4, H.264, AAC, 30fps mín |
| CTA | Antes de los hashtags. "Reserva en bio" / "Escríbenos por DM" |
| Tono | El más visual y aspiracional. Primera línea = gancho |

**Estructura típica de caption:**
```
[Gancho fuerte en 1-2 líneas]

[2-3 líneas de contexto o historia]

[CTA]

[hashtags separados del texto]
```

---

## Facebook

| Parámetro | Límite / Regla |
|-----------|---------------|
| Copy | 63.206 chars máx. Óptimo: 40-80 palabras para posts orgánicos |
| Hashtags | 1-3 máximo (alta densidad de hashtags penaliza alcance en FB) |
| Aspect ratio | 1:1 o 4:5 para fotos; 16:9 para vídeos largos |
| Vídeo | Hasta 240 min; óptimo para engagement: 1-3 min |
| Tono | Más narrativo y conversacional que IG. Puede incluir contexto |
| CTA | Más explícito ("Llámanos", "Reserva aquí", "Escríbenos") |
| Compartir | El copy debe poder leerse bien en un share sin el visual |

**Adaptación desde IG:**
- Eliminar o reducir hashtags
- Expandir el copy con contexto adicional si el contenido lo permite
- Añadir número de teléfono o WhatsApp si aplica

---

## TikTok

| Parámetro | Límite / Regla |
|-----------|---------------|
| Copy | 2.200 chars máx; texto en el propio vídeo suele ser más efectivo que caption |
| Hashtags | 3-5 (mezcla de nicho + trending) |
| Duración | 15s-10min; óptimo para alcance orgánico: 15-60s |
| Aspect ratio | 9:16 (1080×1920px) |
| Vídeo spec | MP4, H.264, AAC, sin letterboxing |
| Tono | El más informal, directo, con gancho en los primeros 3 segundos |
| Música | TikTok tiene su propia librería; evitar música con copyright |
| CTA | "Síguenos", "Comenta si...", "Dueto con este vídeo" |

**Importante:** TikTok API no está implementado en producción todavía (ver `ADR-001`). El copy se genera pero la publicación es manual.

---

## Google My Business (GMB)

| Parámetro | Límite / Regla |
|-----------|---------------|
| Copy | 1.500 chars máx. Óptimo: 150-300 chars |
| Hashtags | **Ninguno** — GMB no soporta hashtags |
| Tipo de post | `STANDARD` (con imagen) o `OFFER` (con fechas y código) |
| Imagen | Mínimo 400×300px; óptimo 1200×900px (4:3) |
| CTA obligatorio | Uno de: `BOOK`, `ORDER`, `SHOP`, `LEARN_MORE`, `SIGN_UP`, `CALL` |
| Tono | Informativo y local. Mencionar ubicación o servicio específico |
| Duración del post | Caduca a los 7 días (posts estándar). Los eventos duran hasta su fecha fin |

**Ejemplo de copy GMB:**
```
Pasta fresca elaborada cada mañana en Las Palmas.

Esta semana: Cacio e Pepe con pecorino importado de Roma.
Abrimos martes a domingo desde las 13:00.

[CTA: BOOK → enlace a reserva]
```

---

## Stories (Instagram y Facebook)

| Parámetro | Límite / Regla |
|-----------|---------------|
| Aspect ratio | 9:16 (1080×1920px) |
| Duración vídeo | 15s (se auto-divide si es más largo) |
| Texto en pantalla | Limitado — el visual debe comunicar por sí solo |
| Copy en caption | No aplica (stories no tienen caption público) |
| Stickers/GIFs | Los más efectivos: encuesta, pregunta, countdown |
| Tono | El más casual y efímero. Puede ser menos cuidado que Feed |

---

## Carrusel (Instagram)

| Parámetro | Límite / Regla |
|-----------|---------------|
| Slides | 2-10 imágenes o vídeos |
| Primera slide | La más visual — determina si el usuario desliza |
| Última slide | Siempre CTA o "Desliza para..." en la penúltima |
| Copy | Ídem Instagram Feed. El caption aplica a todo el carrusel |
| Formato | Todas las slides deben tener el mismo aspect ratio |

---

## Función `generateCopiesPerPlatform()`

Esta función en `src/lib/claude/index.ts` recibe:
- `brandBrain`: el Brand Brain completo
- `idea`: la idea aprobada con `concept` y `full_description`
- `platforms`: array de `Platform` (`['instagram', 'facebook', 'gmb']`)

Y devuelve un objeto con el copy adaptado por plataforma:
```typescript
{
  instagram?: { copy: string, hashtags: string[], cta: string },
  facebook?: { copy: string, hashtags: string[], cta: string },
  tiktok?: { copy: string, hashtags: string[], cta: string },
  gmb?: { copy: string, cta: string }
}
```

Se guarda en `content_tasks.copies_per_platform` (JSONB) y se usa al crear los `posts` individuales.

---

## Anti-patrones a evitar

- **No usar el mismo copy en todas las plataformas** — Claude debe adaptar el tono, longitud y hashtags
- **No incluir hashtags en el texto de GMB** — rompe el estilo local
- **No superar 30 hashtags en Instagram** — Meta penaliza el alcance
- **No copiar el copy de IG directamente a TikTok** — TikTok espera un gancho distinto en los primeros 3 segundos
- **No olvidar el CTA en GMB** — el campo es obligatorio en la API y mejora el CTR significativamente
