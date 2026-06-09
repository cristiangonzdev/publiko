# Ciclo de vida del contenido — 12 estados

Una pieza de contenido (un reel, un post, una story) existe como fila en `content_tasks` y transita por 12 estados desde su creación hasta su publicación. Cada transición tiene un actor, un disparador y efectos secundarios.

---

## Diagrama de flujo

```
                    GENERACIÓN
                        │
                   [suggested] ←─────── Claude genera ideas (cron 6am o admin manual)
                        │
          ┌─────────────┴──────────────┐
          │ approval_tier = 'auto'     │ approval_tier = 'manual'
          │ judgeContent() pasa        │ siempre requiere admin
          │                            │
          ▼                            ▼
    [approved_idea] ◄──────────── Admin aprueba
          │
          ▼
     [brief_sent] ←────────── Admin asigna grabador+editor, genera briefs
          │
          ▼                     (Telegram → grabador)
      [recording]
          │
          ▼
   [brutos_ready] ←──────── Grabador sube material bruto + pulsa "Listos"
          │                     (Telegram → editor)
          ▼
      [editing]
          │
          ▼
     [delivered] ←──────── Editor sube entregable + pulsa "Entregar"
          │                     (Telegram → admin)
          │
    ┌─────┴──────────────────────────┐
    │ Admin aprueba                  │ Admin pide revisión
    ▼                                ▼
 [approved]                      [revision] ──► (vuelta a editing)
    │                     (Telegram → editor con notas)
    │ Admin elige plataformas + hora
    ▼
 [scheduled] ←────── Se crean filas en tabla `posts` (1 por plataforma)
    │
    │ Cron cada 15 min publica via Meta/GMB
    ▼
 [published] ← estado terminal exitoso
    │
    └── Métricas harvested (reach, likes, engagement)
        → Si supera p75 baseline → INSERT winning_patterns

[failed] ← terminal de error (3 reintentos de cron agotados)
[discarded] ← terminal de descarte (admin descarta idea antes de producción)
```

---

## Tabla de estados

| Estado | Actor | Disparador | Campos que cambian | Notificaciones |
|--------|-------|-----------|-------------------|----------------|
| `suggested` | Sistema / Admin | Cron `daily-generation` o admin llama `/api/ideas/generate` | INSERT content_ideas, INSERT content_tasks (si auto-tier) | — |
| `approved_idea` | Admin / Auto | Admin aprueba en `/admin/clients/[id]/ideas` O `judgeContent().passes = true` | `content_ideas.status = 'approved_idea'`, `approved_at`, `approved_by` | — |
| `brief_sent` | Admin | Admin pulsa "Enviar a producción" → `POST /api/tasks/[id]/to-production` | `content_tasks.status`, `grabador_id`, `editor_id`, `deadline`, `brief_sent_at`, `recording_brief`, `editing_brief`, `copy_options`, `copies_per_platform` | Telegram → grabador |
| `recording` | Grabador | Grabador abre la tarea (o al confirmar recepción) | `recording_started_at` | — |
| `brutos_ready` | Grabador | `POST /api/tasks/[id]/brutos-ready` | `brutos_uploaded_at`, `bruto_asset_ids[]`, INSERT assets (category='bruto') | Telegram → editor |
| `editing` | Editor | Editor pulsa "Empezar edición" | `editing_started_at` | — |
| `delivered` | Editor | `POST /api/tasks/[id]/deliverable-confirm` | `delivered_at`, `final_asset_id`, INSERT assets (category='deliverable') | Telegram → admin |
| `revision` | Admin | `POST /api/tasks/[id]/revision` con `revision_notes` | `revision_notes`, `revision_count++` | Telegram → editor |
| `approved` | Admin | Admin aprueba entregable en `/admin/review` | `approved_at` | — |
| `scheduled` | Admin | Admin elige plataformas + `publish_at` | INSERT posts[] (1 por plataforma, `status='scheduled'`, `scheduled_at`) | — |
| `published` | Cron | `GET /api/cron/publish-retry` publica via Meta/GMB API | `posts.status='published'`, `external_post_id`, `published_at` | Telegram → admin ("✅ Publicado") |
| `failed` | Cron | 3 reintentos de publicación agotados | `posts.status='failed'`, `failure_reason` | Telegram → admin ("🚨 PUBLICACIÓN ABORTADA") |

---

## Regla del approval_tier

Cada `content_idea` tiene un campo `approval_tier: 'auto' | 'manual'`.

**`auto`:** Cuando `generateDailyBatch()` crea la idea, el cron dispara `/api/ideas/[id]/auto-process` que:
1. Crea `content_task` asociado
2. Llama `generateBriefs()` → guarda `recording_brief` + `editing_brief`
3. Llama `generateCopyOptions()` → guarda `copy_options` (3 alternativas)
4. Llama `generateCopiesPerPlatform()` → guarda `copies_per_platform`
5. Llama `judgeContent()` → guarda `judge_verdict`
6. Si `judge_verdict.passes = true` → status = `approved_idea` (sin intervención humana)
7. Si `judge_verdict.passes = false` → status queda en `suggested` con `auto_publish_blocked_reason`

**`manual`:** El admin siempre debe aprobar explícitamente, independientemente del judge.

---

## Reintentos de publicación (backoff exponencial)

Cuando el cron `publish-retry` intenta publicar y Meta API devuelve error:

| Intento | Campo `retry_count` | `scheduled_retry_at` |
|---------|--------------------|--------------------|
| 1er fallo | 1 | `now() + 15 min` |
| 2º fallo | 2 | `now() + 1 hora` |
| 3er fallo | 3 | — (se marca como `failed`) |

El cron selecciona posts con:
```sql
WHERE status = 'scheduled'
  AND (
    (scheduled_at <= now() AND scheduled_retry_at IS NULL)
    OR (scheduled_retry_at IS NOT NULL AND scheduled_retry_at <= now() AND retry_count < 3)
  )
```

---

## Tabla `posts` vs tabla `content_tasks`

Son entidades distintas:
- `content_tasks` → la pieza de contenido como unidad de producción (1 tarea → N plataformas)
- `posts` → la publicación en una plataforma específica (1 row por plataforma)

Cuando el admin aprueba un entregable y elige publicar en IG + FB, se crean **2 rows en `posts`** (uno por plataforma), cada uno con su propio `copy` (adaptado por plataforma), `scheduled_at` y flujo de publicación independiente.

---

## Relación circular content_ideas ↔ content_tasks

`content_ideas.content_task_id` → `content_tasks.id` (FK agregada en init como constraint separado por circularidad)
`content_tasks.idea_id` → `content_ideas.id`

Esto permite navegar en ambas direcciones. Al crear un `content_task` desde una idea, se actualiza `content_ideas.content_task_id` para cerrar el círculo.
