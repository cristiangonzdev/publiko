# n8n Workflows + API Integrations

---

## Workflows de n8n

### WF-01 — Generación de plan semanal de contenido

**Trigger:** Cron — lunes 09:00
**Descripción:** Genera ideas de contenido para todos los clientes activos

```
[Cron Monday 09:00]
    ↓
[Supabase: SELECT clientes activos con onboarding_completed=true]
    ↓
[Loop por cada cliente]
    ├── [Supabase: GET brand_brain completo del cliente]
    ├── [Supabase: GET últimas 30 ideas (anti-repetición)]
    ├── [Supabase: GET eventos especiales del mes]
    ├── [Anthropic Claude: generar 5 ideas sistema + 2 ideas humano]
    │       Model: claude-sonnet-4-20250514
    │       Max tokens: 2000
    │       Response format: JSON
    ├── [Supabase: INSERT ideas en content_ideas]
    └── [Telegram: notificar al admin]
        "📋 Plan semanal listo — {business_name}
         5 ideas sistema + 2 ideas humano
         Ver: {dashboard_url}/admin/ideas"
```

---

### WF-02 — Scheduler de publicación

**Trigger:** Cron — cada 30 minutos
**Descripción:** Publica posts que tienen `scheduled_at <= now()`

```
[Cron cada 30 min]
    ↓
[Supabase RPC: get_posts_to_publish()]
    ↓
[IF posts.length === 0 → END]
    ↓
[Loop por cada post]
    ├── [Supabase Storage: Get signed URL del asset]
    ├── [IF platform = 'instagram' OR 'facebook']
    │       ├── [Meta API: Upload media container]
    │       │       POST /{ig_account_id}/media
    │       │       body: { media_type, video_url/image_url, caption }
    │       ├── [Wait: 30 segundos para processing]
    │       ├── [Meta API: Publish container]
    │       │       POST /{ig_account_id}/media_publish
    │       │       body: { creation_id }
    │       └── [Supabase: UPDATE post status='published', external_post_id]
    ├── [IF platform = 'tiktok']
    │       ├── [TikTok API: Upload + publish]
    │       └── [Supabase: UPDATE post status='published']
    ├── [Supabase: UPDATE content_task status='published']
    └── [Telegram: "✅ Publicado — {business_name} — {concept}"]

[IF error en cualquier paso]
    ├── [Supabase: UPDATE post failure_reason, increment retry_count]
    ├── [IF retry_count >= 3]
    │       └── [Telegram URGENTE: "❌ FALLO publicación — {business_name} — {concept}"]
    └── [IF retry_count < 3]
            └── [Schedule retry en 15 minutos]
```

---

### WF-03 — Analytics harvest semanal

**Trigger:** Cron — lunes 08:00 (antes del WF-01)
**Descripción:** Recoge métricas de Meta API y genera informe

```
[Cron Monday 08:00]
    ↓
[Supabase: SELECT clientes activos]
    ↓
[Loop por cada cliente]
    ├── [Supabase: GET posts publicados en los últimos 7 días]
    ├── [Loop por cada post publicado]
    │       ├── [Meta API: GET /{media_id}/insights]
    │       │       metrics: reach,impressions,likes,comments,shares,saved
    │       └── [Supabase: UPDATE posts con métricas]
    ├── [Calcular agregados de la semana]
    ├── [Supabase: INSERT weekly_reports]
    ├── [Anthropic Claude: generar ai_summary y ai_recommendations]
    │       Context: métricas de la semana + brand brain
    ├── [Actualizar brand_brain.performance_learning]
    ├── [HTTP: POST /api/reports/generate-pdf]
    │       → API Route de Next.js genera el PDF
    ├── [Google Drive: Upload PDF a /reportes/]
    ├── [Supabase: UPDATE weekly_reports pdf_url]
    └── [Resend: Email al cliente con PDF adjunto]
```

---

### WF-04 — Onboarding de nuevo cliente

**Trigger:** Webhook — `POST /webhooks/client-onboarding-completed`
**Descripción:** Setup automático cuando se completa el brand brain

```
[Webhook: client.onboarding_completed]
    ↓
[Supabase: GET client data + brand brain]
    ↓
[Google Drive: Crear estructura de carpetas]
    ├── /{client_slug}/
    │   ├── /brutos/
    │   ├── /editados/
    │   ├── /publicados/
    │   ├── /assets/fotos/
    │   ├── /assets/referencias/
    │   └── /reportes/
    ↓
[Supabase: UPDATE client drive_folder_id]
    ↓
[HTTP: POST /api/ideas/generate-first-batch]
    → Genera las primeras 10 ideas del cliente
    ↓
[Resend: Email bienvenida al cliente]
    ↓
[Telegram al admin: "🎉 Onboarding completado — {business_name}
  Drive: {drive_url}
  10 ideas generadas y listas para revisar"]
```

---

### WF-05 — Notificación al editor cuando hay brutos

**Trigger:** Webhook — `POST /webhooks/brutos-ready`
**Descripción:** Cuando el grabador marca brutos listos

```
[Webhook: task.brutos_ready]
    ↓
[Supabase: GET task + client + editor asignado]
    ↓
[Supabase: UPDATE task status='brutos_ready', brutos_uploaded_at]
    ↓
[Telegram al editor: 
  "🎬 Brutos listos — {business_name}
   Concepto: {concept}
   Drive: {drive_brutos_url}
   Deadline edición: {deadline}
   Dashboard: {editor_dashboard_url}"]
```

---

### WF-06 — Monitorización de reseñas

**Trigger:** Cron — diario 10:00
**Descripción:** Detecta nuevas reseñas en Google My Business

```
[Cron 10:00]
    ↓
[Supabase: SELECT clientes con GMB activo]
    ↓
[Loop por cada cliente]
    ├── [GMB API: GET /accounts/{accountId}/locations/{locationId}/reviews]
    │       filter: desde última comprobación
    ├── [Loop por cada reseña nueva]
    │       ├── [Anthropic Claude: clasificar sentimiento]
    │       ├── [Anthropic Claude: generar 2 opciones de respuesta]
    │       │       Context: brand brain + tono review_response_tone
    │       ├── [Supabase: INSERT review con opciones]
    │       └── [Telegram al admin:
    │               "⭐ Nueva reseña — {business_name}
    │                Rating: {rating}/5
    │                '{review_text_preview}'
    │                Respuestas generadas → {review_url}"]
    └── [Supabase: UPDATE last_review_check timestamp]
```

---

### WF-07 — Notificación al grabador de nueva tarea

**Trigger:** Webhook — `POST /webhooks/task-assigned-grabador`
**Descripción:** Cuando se asigna una tarea de grabación

```
[Webhook: task.assigned_to_grabador]
    ↓
[Supabase: GET task + grabador profile (telegram_chat_id)]
    ↓
[Telegram al grabador:
  "📸 Nueva tarea de grabación — {business_name}
   Concepto: {concept}
   Deadline: {deadline}
   Drive: {drive_folder_url}
   Dashboard: {grabador_dashboard_url}"]
```

---

## API Integrations

### Meta Graph API

**Base URL:** `https://graph.facebook.com/v19.0`
**Auth:** System User Token (no expira) — guardado en `clients.meta_system_user_token`

**Endpoints utilizados:**

```typescript
// Publicar Reel en Instagram
POST /{ig-user-id}/media
{
  media_type: "REELS",
  video_url: "https://...", // URL pública del vídeo
  caption: "Copy del post con hashtags",
  share_to_feed: true
}

// Publicar imagen en Feed
POST /{ig-user-id}/media
{
  image_url: "https://...",
  caption: "Copy del post"
}

// Publicar container creado
POST /{ig-user-id}/media_publish
{
  creation_id: "{container_id}"
}

// Métricas de un post
GET /{media-id}/insights
?metric=reach,impressions,likes_count,comments_count,shares,saved
&period=lifetime

// Métricas de cuenta (seguidores)
GET /{ig-user-id}/insights
?metric=follower_count
&period=day
```

**Helper en `/lib/meta/instagram.ts`:**

```typescript
export async function publishReel(params: {
  igAccountId: string
  token: string
  videoUrl: string
  caption: string
}): Promise<{ postId: string; postUrl: string }> {
  // 1. Create media container
  const container = await fetch(
    `https://graph.facebook.com/v19.0/${params.igAccountId}/media`,
    {
      method: 'POST',
      body: JSON.stringify({
        media_type: 'REELS',
        video_url: params.videoUrl,
        caption: params.caption,
        share_to_feed: true,
        access_token: params.token
      })
    }
  )
  
  // 2. Wait for processing
  await waitForMediaProcessing(container.id, params.token)
  
  // 3. Publish
  const publish = await fetch(
    `https://graph.facebook.com/v19.0/${params.igAccountId}/media_publish`,
    {
      method: 'POST',
      body: JSON.stringify({
        creation_id: container.id,
        access_token: params.token
      })
    }
  )
  
  return {
    postId: publish.id,
    postUrl: `https://www.instagram.com/p/${publish.id}`
  }
}
```

---

### Google Drive API

**Auth:** OAuth2 con refresh token (service account o OAuth app)
**Scope:** `https://www.googleapis.com/auth/drive`

**Operaciones principales:**

```typescript
// Crear carpeta
POST https://www.googleapis.com/drive/v3/files
{
  name: "brutos",
  mimeType: "application/vnd.google-apps.folder",
  parents: [parentFolderId]
}

// Subir archivo
POST https://www.googleapis.com/upload/drive/v3/files
  ?uploadType=multipart

// Obtener URL de descarga
GET https://www.googleapis.com/drive/v3/files/{fileId}
  ?alt=media

// Listar archivos en carpeta
GET https://www.googleapis.com/drive/v3/files
  ?q='{folderId}' in parents and trashed=false
```

**Helper en `/lib/drive/index.ts`:**

```typescript
export async function createClientFolderStructure(
  clientSlug: string,
  rootFolderId: string
): Promise<Record<string, string>> {
  const structure = ['brutos', 'editados', 'publicados', 'assets/fotos', 'assets/referencias', 'reportes']
  const folderIds: Record<string, string> = {}
  
  // Crear carpeta raíz del cliente
  const clientFolder = await createFolder(clientSlug, rootFolderId)
  folderIds.root = clientFolder.id
  
  // Crear subcarpetas
  for (const path of structure) {
    // Manejar subcarpetas anidadas
    const parts = path.split('/')
    let parentId = clientFolder.id
    for (const part of parts) {
      const folder = await createFolder(part, parentId)
      folderIds[path] = folder.id
      parentId = folder.id
    }
  }
  
  return folderIds
}
```

---

### Anthropic Claude API

**Model:** `claude-sonnet-4-20250514`
**Uso:** Generación de ideas, copy, briefs de edición, análisis de métricas, respuestas a reseñas

**Llamadas principales:**

```typescript
// 1. Generación de ideas semanales
// Input: brand brain completo + recent ideas
// Output: JSON con 5 ideas sistema + 2 ideas humano

// 2. Generación de copy con 3 opciones
// Input: idea aprobada + brand brain
// Output: JSON con 3 variantes de copy + hashtags + CTA

// 3. Brief de edición
// Input: idea + copy seleccionado + visual_identity del brand brain
// Output: JSON con brief completo para el editor

// 4. Análisis de métricas y resumen semanal
// Input: métricas de la semana + brand brain
// Output: texto narrativo (ai_summary) + recomendaciones (ai_recommendations)

// 5. Respuesta a reseñas
// Input: reseña + brand brain (voice + review_response_tone)
// Output: 2 opciones de respuesta

// 6. Guión de contenido humano
// Input: human_input + brand brain
// Output: estructura de guión (gancho + desarrollo + cierre)
```

**Helper en `/lib/claude/index.ts`:**

```typescript
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export async function generateWeeklyIdeas(
  brandBrain: BrandBrain,
  recentIdeas: ContentIdea[],
  weekContext: string
): Promise<{ systemIdeas: IdeaDraft[], humanIdeas: IdeaDraft[] }> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system: buildSystemPrompt(brandBrain, recentIdeas),
    messages: [
      {
        role: 'user',
        content: `Genera el plan de contenido para la semana. ${weekContext}
        
Responde SOLO en JSON válido, sin markdown ni explicaciones.`
      }
    ]
  })
  
  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  return JSON.parse(text)
}
```

---

### Telegram Bot API

**Uso:** Notificaciones internas al equipo (admin, editor, grabador)
**Base URL:** `https://api.telegram.org/bot{TOKEN}`

**Mensajes que se envían:**

| Evento | Destinatario | Mensaje |
|---|---|---|
| Plan semanal generado | Admin | 📋 Plan listo con preview de ideas |
| Entregable recibido | Admin | 🎞️ [Cliente] entregó — revisar en dashboard |
| Brutos listos | Editor | 🎬 Brutos disponibles + link Drive |
| Nueva tarea grabación | Grabador | 📸 Nueva tarea + brief + deadline |
| Post publicado | Admin | ✅ Publicado correctamente |
| Error de publicación | Admin | ❌ FALLO — requiere atención |
| Nueva reseña | Admin | ⭐ Reseña nueva + rating |
| Onboarding completado | Admin | 🎉 Nuevo cliente operativo |

```typescript
// Helper en /lib/telegram/index.ts
export async function sendTelegramMessage(
  chatId: string,
  text: string,
  parseMode: 'HTML' | 'Markdown' = 'HTML'
): Promise<void> {
  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: parseMode })
  })
}
```

---

### Resend (Email)

**Uso:** Informe semanal al cliente, email de bienvenida, facturas

```typescript
// Helper en /lib/email/index.ts
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendWeeklyReport(params: {
  clientEmail: string
  clientName: string
  businessName: string
  reportPdfUrl: string
  summary: string
  weekDates: string
}): Promise<void> {
  await resend.emails.send({
    from: 'Logika Digital <hola@logikateam.com>',
    to: params.clientEmail,
    subject: `Informe semanal — ${params.businessName} — ${params.weekDates}`,
    html: buildWeeklyReportEmail(params), // template HTML
    attachments: [
      {
        filename: `informe-${params.weekDates}.pdf`,
        path: params.reportPdfUrl
      }
    ]
  })
}
```

---

## Webhooks de Next.js que llama n8n

Todos en `/app/api/webhooks/`:

| Endpoint | Trigger | Acción |
|---|---|---|
| `POST /api/webhooks/task-delivered` | Editor sube entregable | Notifica al admin |
| `POST /api/webhooks/brutos-ready` | Grabador marca listo | Notifica al editor |
| `POST /api/webhooks/task-assigned` | Admin asigna tarea | Notifica al asignado |
| `POST /api/webhooks/client-onboarding` | Onboarding completado | Setup automático |

Todos los webhooks de n8n hacia Next.js llevan un header `x-webhook-secret` para validar origen.
