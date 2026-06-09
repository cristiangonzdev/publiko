# Arquitectura — Publiko

## Visión general

Publiko es una aplicación Next.js 16 (App Router) que actúa como panel de control multi-rol para una agencia de social media. La lógica de negocio vive en API routes del servidor. Supabase provee base de datos, autenticación y almacenamiento de archivos. Las integraciones externas (Meta, GMB, Drive, Telegram, Resend) se invocan solo desde el servidor.

```
Browser (Client Components)
    │
    ├── Server Components / Server Actions (Next.js)
    │       │
    │       ├── Supabase (PostgreSQL + Auth + Storage)
    │       │
    │       ├── Claude API — generación de contenido
    │       │
    │       ├── Meta Graph API — publicación IG + FB + métricas
    │       │
    │       ├── Google Business Profile — publicación + reseñas
    │       │
    │       ├── Google Drive — almacén de brutos de vídeo
    │       │
    │       ├── Telegram Bot — notificaciones al equipo
    │       │
    │       └── Resend — emails al cliente final
    │
    └── Vercel Cron Jobs (4 tareas automáticas)
```

---

## Integraciones externas

### Claude API
- **Módulo:** `src/lib/claude/index.ts`
- **Modelo:** `claude-sonnet-4-6` (nunca cambiar sin ADR en `docs/decisions.md`)
- **Propósito:** Generación de ideas, copy, briefs de grabación y edición, copies por plataforma, juez de calidad (judge), respuestas a reseñas
- **Credencial:** `ANTHROPIC_API_KEY` (server-only)
- **Patrón:** Ver `@.claude/skills/claude-generation.md`

### Meta Graph API v21.0
- **Módulo:** `src/lib/meta/index.ts` (publicación) + `src/lib/meta/analytics.ts` (métricas)
- **Propósito:** Publicar en Instagram y Facebook (fotos, vídeos, stories); recoger métricas de posts publicados (reach, likes, engagement, etc.)
- **Credenciales por cliente:** `clients.meta_system_user_token` + `clients.meta_business_id` + `clients.facebook_page_id` — nunca hardcodeadas
- **Patrón:** Ver `@.claude/skills/meta-publishing.md`

### Google Business Profile (GMB)
- **Módulo:** `src/lib/gmb/index.ts`
- **Propósito:** Publicar posts en Google My Business (`publishLocalPost`); recoger reseñas nuevas (`getGMBReviews`)
- **Credenciales por cliente:** `clients.gmb_account_id` + `clients.gmb_location_id`
- **Credenciales globales:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`

### Google Drive
- **Módulo:** `src/lib/drive/index.ts`
- **Propósito:** Crear carpeta por cliente al hacer onboarding (`createClientFolder`); listar archivos para que editores descarguen brutos (`getClientFolderFiles`); subir assets (`uploadAssetToDrive`)
- **Carpeta raíz:** `GOOGLE_DRIVE_ROOT_FOLDER_ID`
- **ID por cliente:** `clients.drive_folder_id`

### Telegram Bot
- **Módulo:** `src/lib/telegram/index.ts`
- **Propósito:** Notificaciones en tiempo real al equipo
  - Grabador: nueva tarea asignada, deadline cercano
  - Editor: brutos listos, revisión solicitada
  - Admin: entregable listo, publicación OK, fallo de publicación
- **Credenciales:** `TELEGRAM_BOT_TOKEN` (global) + `profiles.telegram_chat_id` (por usuario) + `TELEGRAM_ADMIN_CHAT_ID` (canal admin)

### Resend
- **Módulo:** `src/lib/email/notifications.ts`
- **Propósito:** Emails al cliente final
  - Plan semanal listo: `notifyClientNewWeeklyContent()`
  - Input humano necesario: `notifyClientHumanInputNeeded()`
- **Credencial:** `RESEND_API_KEY`
- **From:** configurable, usar dominio propio

---

## Cron Jobs (Vercel)

Configurados en `vercel.json`. Todos validan `Authorization: Bearer ${CRON_SECRET}`.

### `GET /api/cron/daily-generation`
- **Schedule:** `0 6 * * *` (06:00 AM diario)
- **Qué hace:** Para cada cliente activo con `daily_generation_config` habilitado, llama a `generateDailyBatch()` y crea ideas con `approval_tier = 'auto' | 'manual'`. Las ideas `auto` se procesan en paralelo via `/api/ideas/[id]/auto-process` (genera briefs, copies, judge, aprueba si pasa).
- **Fallo silencioso:** Si un cliente falla, continúa con el siguiente. El error queda en logs de Vercel.

### `GET /api/cron/publish-retry`
- **Schedule:** `*/15 * * * *` (cada 15 minutos)
- **Qué hace:** Llama a RPC `get_posts_to_publish()` → para cada post publica via Meta API o GMB. Backoff exponencial en fallos: 1er reintento a los 15 min, 2º a 1h, 3º a 4h. Tras 3 fallos → `status = 'failed'` + alerta Telegram al admin.
- **Fallo silencioso:** Si Meta API está caída, los reintentos siguen acumulándose hasta agotar intentos.

### `GET /api/cron/reviews-harvest`
- **Schedule:** `0 * * * *` (cada hora)
- **Qué hace:** Para cada cliente con `gmb_location_id`, trae reseñas nuevas de Google My Business, genera 2 opciones de respuesta con Claude y las guarda en `reviews.response_options`. Admin selecciona una manualmente en `/admin/reviews`.
- **Fallo silencioso:** Si Google OAuth token ha expirado, el cliente se salta y el error queda en logs.

### `GET /api/cron/cleanup-assets`
- **Schedule:** `0 3 * * *` (03:00 AM diario)
- **Qué hace:** Borra archivos de Supabase Storage cuyo `deleted_at` tenga más de 14 días (soft delete → hard delete). Mantiene la tabla `assets` con metadatos pero elimina el binario.
- **Fallo silencioso:** Si falla, los archivos permanecen en Storage (sin coste adicional inmediato).

---

## Convenciones de API routes

### Auth pattern (todas las routes que modifican datos)
```typescript
import { getAuthUser } from '@/lib/auth/getUser'

export async function POST(req: Request) {
  const { user, role } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  // ...
}
```

### Supabase client vs service client
- `createClient()` — usa el token del usuario autenticado + RLS activo. Para lectura normal.
- `createServiceClient()` — usa `SERVICE_ROLE_KEY`, bypasea RLS. Solo en: crons, webhooks, operaciones privilegiadas de admin donde RLS bloquearía inserts cross-user.

### Cron auth pattern
```typescript
const authHeader = request.headers.get('authorization')
if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

### Webhook auth pattern
```typescript
const secret = request.headers.get('x-webhook-secret')
if (secret !== process.env.WEBHOOK_SECRET) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

---

## Layout groups (rutas protegidas)

El middleware en `src/middleware.ts` redirige usuarios no autenticados a `/login`. Los layout groups agrupan rutas por rol:

| Group | Rutas | Verificación de rol |
|-------|-------|---------------------|
| `(admin)` | `/admin/*` | Middleware + RLS |
| `(editor)` | `/editor/*` | Middleware + RLS |
| `(grabador)` | `/grabador/*` | Middleware + RLS |
| `(cliente)` | `/cliente/*` | Middleware + RLS |

El middleware no verifica rol (solo autenticación). El rol se verifica en cada page/layout leyendo `profiles.role`.

---

## Supabase Storage

- **Bucket:** `assets` (único bucket para todos los clientes)
- **Organización:** `/{client_id}/{category}/{filename}`
- **Acceso:** Siempre via signed URLs generadas en `src/lib/upload/signed-upload.ts`. Sin URLs públicas permanentes.
- **Tamaño máximo local:** 50 MiB (supabase/config.toml). En producción, Supabase Pro no tiene límite estricto por archivo.
- **Soft delete:** La tabla `assets` tiene `deleted_at`. El cron `cleanup-assets` hace el hard delete en Storage 14 días después.
