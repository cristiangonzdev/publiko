# Publiko — Agency OS

Sistema operativo completo para agencias de gestión de redes sociales. Gestiona múltiples clientes, genera contenido con Claude AI, coordina grabadores y editores, publica automáticamente en redes sociales y reporta resultados. Ticket mínimo: €900/mes por cliente.

---

## Antes de empezar cualquier tarea

1. **Lee este archivo completo** — entiende el dominio, los roles y las reglas de seguridad antes de escribir una sola línea.
2. **Identifica qué subagente aplica** — cada área del sistema tiene un agente especializado en `.claude/agents/`. Léelo.
3. **Lee las skills relevantes** en `.claude/skills/` antes de tocar Supabase RLS, Claude API, Meta API o publicación.

Si la tarea crea una tabla nueva → `@.claude/agents/architect.md` primero.
Si la tarea toca Claude API → `@.claude/skills/claude-generation.md` primero.
Si la tarea toca Meta o publicación → `@.claude/skills/meta-publishing.md` primero.
Si vas a hacer merge → `@.claude/agents/reviewer.md` primero.

---

## Los 4 roles

| Rol | Portal | Qué puede hacer |
|-----|--------|-----------------|
| `admin` | `/admin/*` | Todo: CRM, aprobación de contenido, asignación de equipo, publicación, facturación, configuración |
| `grabador` | `/grabador/*` | Solo tareas de grabación asignadas: ver brief, subir brutos, marcar listos |
| `editor` | `/editor/*` | Solo tareas de edición asignadas: descargar brutos, subir entregable, marcar entregado |
| `cliente` | `/cliente/*` | Solo su contenido: calendario, métricas, assets, facturas, onboarding Brand Brain |

Los roles están enforced por **RLS en Supabase** (no solo en middleware). Ver `@docs/security.md`.

---

## Stack y versiones exactas

```
next                    ^16.0.0
react                   ^19.0.0
react-dom               ^19.0.0
@supabase/supabase-js   ^2.50.0
@supabase/ssr           ^0.10.3
@anthropic-ai/sdk       ^0.40.0
googleapis              ^171.4.0
resend                  ^4.0.0
zod                     ^3.23.8
clsx                    ^2.1.1
tailwind-merge          ^2.5.4
typescript              ^5.7.2
tailwindcss             ^3.4.15

Modelo Claude: claude-sonnet-4-6   ← NUNCA cambiar sin ADR en docs/decisions.md
PostgreSQL: 15 (Supabase)
Node.js target: ES2022
```

---

## Árbol de directorios

```
/
├── CLAUDE.md                          ← Estás aquí
├── NEXT_STEPS.md                      ← Guía de deploy inicial
├── package.json
├── tsconfig.json                      ← strict: true, alias @/* → ./src/*
├── next.config.ts
├── tailwind.config.ts
├── vercel.json                        ← Cron jobs (8 crons configurados)
├── .env.example
│
├── docs/
│   ├── architecture.md                ← Integraciones externas, crons, convenciones API
│   ├── brand-brain.md                 ← Estructura Brand Brain + cómo lo usa Claude
│   ├── content-lifecycle.md           ← Los 12 estados del flujo de contenido
│   ├── decisions.md                   ← ADRs (Architecture Decision Records)
│   ├── security.md                    ← RLS por tabla, signed URLs, secrets
│   ├── database-schema.md             ← Schema SQL completo de referencia
│   ├── modules.md                     ← Spec detallada de cada módulo
│   └── n8n-workflows.md               ← Workflows n8n (referencia histórica)
│
├── .claude/
│   ├── settings.json                  ← Permisos de herramientas
│   ├── skills/
│   │   ├── supabase-rls.md            ← Escribir y testear RLS multi-rol
│   │   ├── claude-generation.md       ← Patrón estándar de llamadas a Claude API
│   │   ├── meta-publishing.md         ← Publicación Meta Graph API + retry backoff
│   │   └── platform-adaptation.md    ← Reglas de adaptación copy por plataforma
│   ├── agents/
│   │   ├── architect.md               ← Diseño de schema, contratos de API (opus)
│   │   ├── backend-dev.md             ← API routes, RPCs, lógica server-side
│   │   ├── frontend-dev.md            ← Portales, kanbans, componentes React
│   │   ├── ai-engineer.md             ← Claude API, prompts, generación, judge
│   │   ├── integrations.md            ← Meta, GBP, Drive, Telegram, Resend, crons
│   │   └── reviewer.md                ← Auditoría de seguridad pre-merge
│   └── commands/
│       ├── new-feature.md             ← /new-feature: architect → impl → review
│       ├── security-check.md          ← /security-check: auditoría RLS + secrets
│       └── deploy-check.md            ← /deploy-check: checklist pre-deploy
│
├── src/
│   ├── middleware.ts                  ← Auth guard, redirige /login si no autenticado
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                   ← Redirige según rol
│   │   ├── globals.css
│   │   ├── login/
│   │   │   ├── page.tsx
│   │   │   └── actions.ts
│   │   ├── auth/callback/route.ts     ← OAuth callback de Supabase
│   │   ├── (admin)/
│   │   │   ├── layout.tsx
│   │   │   └── admin/
│   │   │       ├── page.tsx           ← Dashboard (MRR, pipeline, alertas)
│   │   │       ├── atascado/          ← Vista unificada de bloqueos
│   │   │       ├── calendar/          ← Calendario de publicaciones
│   │   │       ├── clients/
│   │   │       │   ├── page.tsx       ← Listado + CRM
│   │   │       │   ├── new/           ← Crear cliente
│   │   │       │   └── [id]/
│   │   │       │       ├── page.tsx   ← Detalle
│   │   │       │       ├── edit/
│   │   │       │       ├── brand-brain/  ← Onboarding 6 pasos
│   │   │       │       ├── ideas/     ← Ideas del cliente (kanban)
│   │   │       │       └── patterns/  ← Winning patterns
│   │   │       ├── ideas/             ← Ideas globales (todos los clientes)
│   │   │       ├── invoices/
│   │   │       ├── pipeline/          ← CRM kanban (lead → active)
│   │   │       ├── reports/
│   │   │       ├── review/            ← Entregables para revisar
│   │   │       ├── reviews/           ← Reseñas Google My Business
│   │   │       ├── tasks/             ← Todas las tareas
│   │   │       └── users/             ← Gestión de usuarios/roles
│   │   ├── (editor)/
│   │   │   └── editor/
│   │   │       ├── page.tsx           ← Kanban de edición
│   │   │       ├── calendario/
│   │   │       └── delivered/
│   │   ├── (grabador)/
│   │   │   └── grabador/
│   │   │       ├── page.tsx           ← Mis grabaciones
│   │   │       ├── calendario/
│   │   │       └── history/
│   │   ├── (cliente)/
│   │   │   └── cliente/
│   │   │       ├── page.tsx           ← Dashboard: semana + publicaciones recientes
│   │   │       ├── onboarding/        ← Brand Brain (si no completado, se fuerza)
│   │   │       ├── assets/
│   │   │       ├── calendario/
│   │   │       ├── facturas/
│   │   │       └── metricas/
│   │   └── api/
│   │       ├── health/
│   │       ├── analytics/harvest/
│   │       ├── clients/[id]/          ← CRUD + brain + brolls + generation-config
│   │       ├── analytics/harvest/     ← Cron analytics
│   │       ├── reports/generate/      ← Cron informes
│   │       ├── cron/                  ← 8 crons en total (ver vercel.json)
│   │       │   ├── cleanup-assets/    ← 3 AM diario
│   │       │   ├── daily-generation/  ← 6 AM diario
│   │       │   ├── publish-retry/     ← Cada 15 min
│   │       │   ├── reviews-harvest/   ← Cada hora
│   │       │   ├── geo-snapshots/     ← Visibilidad IA / geo
│   │       │   └── brain-refinement/  ← Refinamiento Brand Brain
│   │       ├── ideas/                 ← generate, human, [id]/{approve,auto-process,discard}
│   │       ├── invoices/
│   │       ├── notifications/
│   │       ├── posts/[id]/mark-winner/
│   │       ├── publish/
│   │       ├── reviews/               ← harvest, [id]/respond
│   │       ├── tasks/[id]/            ← assign, judge, bruto-*, deliverable-*, platform-copies, etc.
│   │       ├── upload/
│   │       ├── users/
│   │       ├── webhooks/              ← client-onboarding, task-assigned
│   │       └── winning-patterns/
│   ├── components/
│   │   ├── ui/                        ← Sidebar, NotificationBell, WorkloadSummary, ProductionCalendar
│   │   ├── admin/                     ← TasksManager, UsersManager, GenerationConfigPanel, etc.
│   │   ├── brand-brain/               ← BrandBrainForm + 6 steps (Step1Identity…Step6Operations)
│   │   ├── content/                   ← IdeasBoard, GlobalIdeasBoard, AddIdeaModal, ReviewsManager
│   │   ├── crm/                       ← PipelineBoard
│   │   ├── editor/                    ← EditorKanban
│   │   ├── grabador/                  ← GrabadorTaskCard
│   │   └── cliente/                   ← AssetUploader
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts              ← createBrowserClient() — solo para Client Components
│   │   │   ├── server.ts              ← createClient() + createServiceClient() — Server Components y API routes
│   │   │   └── middleware.ts          ← updateSession() — refresca cookie en cada request
│   │   ├── claude/
│   │   │   └── index.ts              ← 12 funciones: generateWeeklyIdeas, generateDailyBatch,
│   │   │                             ←   generateCopyOptions, generateCopiesPerPlatform,
│   │   │                             ←   generateBriefs, judgeContent, generateReviewResponse,
│   │   │                             ←   generateGeoQueries, simulateGeoQuery,
│   │   │                             ←   generateBrainRefinementProposal, buildSystemPrompt,
│   │   │                             ←   buildGeoSystemPromptAddition (+ helpers
│   │   │                             ←   callClaudeJSON / stripMarkdown)
│   │   ├── meta/
│   │   │   ├── index.ts              ← publishToInstagram, publishToFacebook, publishFacebookStory
│   │   │   └── analytics.ts          ← getPostInsights, getIGFollowerCount
│   │   ├── drive/index.ts            ← createClientFolder, getClientFolderFiles, uploadAssetToDrive
│   │   ├── gmb/index.ts              ← publishLocalPost, getGMBReviews
│   │   ├── telegram/index.ts         ← notifyAdmin, notifyUser
│   │   ├── email/notifications.ts    ← notifyClientNewWeeklyContent, notifyClientHumanInputNeeded
│   │   ├── winning-patterns/
│   │   │   ├── detect.ts             ← detectWinners (engagement > p75 baseline)
│   │   │   └── inject.ts             ← attachWinningPatterns, formatWinningPatterns
│   │   ├── upload/signed-upload.ts   ← Genera signed URL para Supabase Storage
│   │   └── auth/getUser.ts           ← getAuthUser() — helper para API routes
│   └── types/
│       └── supabase.ts               ← Tipos auto-generados + tipos custom del dominio
│
└── supabase/
    ├── config.toml
    └── migrations/
        ├── 0001_init.sql             ← Schema base, RLS, RPCs
        ├── 0002_storage_setup.sql    ← Bucket 'assets'
        ├── 0003_scaling.sql          ← approval_tier, copies_per_platform, judge_verdict
        ├── 0004_feedback_loop.sql    ← winning_patterns, client_performance_baselines
        ├── 0005_publish_stories.sql  ← Soporte stories en RPC get_posts_to_publish
        ├── 0006_publish_retries.sql  ← retry_count, scheduled_retry_at, backoff
        ├── 0007_gmb_integration.sql  ← gmb_account_id, gmb_location_id, external_review_id
        ├── 0008_notifications.sql    ← Tabla notifications con RLS in-app
        ├── 0009_facebook_page_id.sql ← Separar facebook_page_id de meta_business_id
        ├── 0010_crm_activities.sql   ← Tabla crm_activities (notas CRM admin-only)
        ├── 0011_ai_visibility.sql    ← Tabla ai_visibility_snapshots (geo / visibilidad IA)
        ├── 0012_brain_revisions.sql  ← Tabla brand_brain_revisions (historial de refinamientos)
        ├── 0013_analytics_reports.sql ← Crons analytics/harvest + reports/generate
        └── 0014_security.sql         ← Hardening de seguridad (RLS / guards)
```

---

## Los 12 estados del flujo de contenido

Una pieza de contenido transita por estos estados en orden. Ver detalle completo en `@docs/content-lifecycle.md`.

```
suggested
    ↓  Admin aprueba (o auto-tier si judge.passes = true)
approved_idea
    ↓  Admin envía a producción: asigna grabador + editor, genera briefs
brief_sent
    ↓  Grabador recibe tarea (Telegram notify)
recording
    ↓  Grabador sube bruto(s) a Storage
brutos_ready
    ↓  Editor recibe aviso (Telegram notify)
editing
    ↓  Editor sube entregable final
delivered
    ↓  Admin revisa entregable
    ↓  Si hay problemas → revision (vuelta a editing tras notas)
revision
    ↓  Editor corrige y re-entrega → delivered
approved
    ↓  Admin elige plataformas + hora → se crean rows en posts (status=scheduled)
scheduled
    ↓  Cron publish-retry (cada 15 min) publica via Meta API
published   ← terminal exitoso
failed      ← terminal de error (3 reintentos agotados)
discarded   ← terminal descartado por admin
```

**Approval tier:**
- `auto` → si `judgeContent()` devuelve `passes: true`, la idea salta de `suggested` a `approved` sin intervención humana
- `manual` → siempre requiere OK explícito del admin

---

## Las 13 tablas principales

| Tabla | Propósito |
|-------|-----------|
| `profiles` | Usuarios del sistema (admin, editor, grabador, cliente) — extiende `auth.users` |
| `clients` | Clientes (negocios): datos de contacto, facturación, credenciales Meta/GMB/Drive, equipo asignado |
| `brand_brains` | Perfil estratégico del cliente en 10 secciones JSONB — alimenta todos los prompts de Claude |
| `content_ideas` | Ideas de contenido generadas por Claude o propuestas por humanos |
| `content_tasks` | Producción end-to-end: grabación + edición + publicación de una pieza |
| `posts` | Posts publicados/programados en cada plataforma con métricas (reach, likes, engagement) |
| `assets` | Archivos en Supabase Storage o Google Drive (brutos, entregables, logos, templates) |
| `winning_patterns` | Patrones de contenido que han superado el baseline de engagement — inyectados en prompts futuros |
| `client_performance_baselines` | Mediana rolling 60 días de engagement por cliente/plataforma/tipo — base para detectar winners |
| `reviews` | Reseñas de Google My Business con borradores de respuesta generados por Claude |
| `weekly_reports` | Informes semanales: métricas agregadas + resumen IA + PDF para el cliente |
| `invoices` | Facturas (setup y recurrentes) con estado de pago |
| `notifications` | Log de notificaciones in-app con read_at para el badge de campana |

**Tablas adicionales (16 en total):** `crm_activities` (notas CRM admin-only), `ai_visibility_snapshots` (snapshots de visibilidad IA / geo) y `brand_brain_revisions` (historial de refinamientos del Brand Brain).

RPCs clave: `get_mrr_total()`, `get_posts_to_publish()`, `compute_client_baseline(client_id)`, `get_winning_patterns_for_prompt(client_id)`, `current_user_role()`.

---

## Reglas de seguridad innegociables

Estas reglas nunca se negocian. Si una tarea entra en conflicto con alguna, detente y pregunta.

### 1. RLS en todas las tablas
Toda tabla nueva debe tener `ALTER TABLE x ENABLE ROW LEVEL SECURITY` y al menos una policy. Sin RLS, cualquier usuario autenticado puede leer datos de otros clientes. Ver policies en `@docs/security.md` y patrón en `@.claude/skills/supabase-rls.md`.

### 2. Signed URLs para todos los assets
Los archivos en Supabase Storage **nunca** se exponen con URL pública permanente. Siempre se generan via `lib/upload/signed-upload.ts`. Las signed URLs expiran (TTL configurado). Ningún `public_url` en la tabla `assets` debe ser una URL de Storage directa sin firma.

### 3. Auth checks en API routes sensibles
Toda API route que modifique datos o acceda a información de clientes debe verificar el usuario autenticado y su rol antes de operar:
```typescript
const { user, role } = await getAuthUser()  // lib/auth/getUser.ts
if (!user || role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
```

### 4. CRON_SECRET y WEBHOOK_SECRET
Todo endpoint de cron valida `Authorization: Bearer ${CRON_SECRET}`. Todo webhook valida su secret correspondiente. Sin esta validación, cualquiera puede disparar generación masiva de contenido o publicación no autorizada.

### 5. SERVICE_ROLE_KEY nunca al cliente
`SUPABASE_SERVICE_ROLE_KEY` es una variable de entorno server-only (sin prefijo `NEXT_PUBLIC_`). Nunca se usa en Client Components ni en código que pueda llegar al navegador. Usar solo en API routes y Server Actions con `createServiceClient()`.

### 6. Claude API solo desde server
`ANTHROPIC_API_KEY` es server-only. Todas las llamadas a Claude van desde API routes (`src/app/api/`) o desde Server Actions. Nunca desde Client Components.

---

## Variables de entorno

```env
# Supabase (pública)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Supabase (privada — nunca al cliente)
SUPABASE_SERVICE_ROLE_KEY=

# Claude API (privada)
ANTHROPIC_API_KEY=

# Meta Graph API (privada)
META_APP_ID=
META_APP_SECRET=

# Google Drive / GBP (privada)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=
GOOGLE_REFRESH_TOKEN_GMB=
GOOGLE_DRIVE_ROOT_FOLDER_ID=

# Telegram (privada)
TELEGRAM_BOT_TOKEN=
TELEGRAM_ADMIN_CHAT_ID=

# Resend — email al cliente (privada)
RESEND_API_KEY=
RESEND_FROM=

# Secrets para crons y webhooks (privada)
CRON_SECRET=
WEBHOOK_SECRET=

# App URL (para signed URLs y emails)
NEXT_PUBLIC_APP_URL=
```

---

## Convenciones de código

- **TypeScript estricto** en todo el proyecto. Sin `any` excepto donde Supabase JSONB lo requiera explícitamente.
- **Server Components por defecto.** `'use client'` solo donde haya interactividad real (estado, eventos).
- **Cero lógica de negocio en componentes.** Todo va en `src/lib/` o en API routes.
- **Supabase RPC para lógica compleja.** No queries inline en componentes ni en Server Actions si la lógica ya existe como RPC.
- **`createClient()` para lectura con permisos de usuario.** `createServiceClient()` solo para operaciones privilegiadas (crons, webhooks, admin actions).
- **Validar con Zod** en el borde (API routes que reciben datos externos, Server Actions).
- **`stripMarkdown()` antes de `JSON.parse()`** en toda respuesta de Claude — el modelo a veces envuelve JSON en triple backtick aunque se le pida que no.
- **Convenciones de commit:** `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`.

---

## Comandos de desarrollo

```bash
# Servidor de desarrollo
npm run dev

# Build completo (lo que corre Vercel — más estricto que tsc)
npm run build

# Type check sin build
npm run typecheck

# Generar tipos de Supabase (tras nueva migración)
npm run supabase:types

# Supabase local
npx supabase start
npx supabase db reset
npx supabase db push
```

---

## Subagentes disponibles

Cada agente tiene su contexto y reglas específicas. Léelos antes de delegar trabajo:

- `@.claude/agents/architect.md` — Diseño de schema, contratos de API, RPCs (modelo opus, solo lectura)
- `@.claude/agents/backend-dev.md` — API routes, Server Actions, RPCs, integraciones server-side
- `@.claude/agents/frontend-dev.md` — Portales por rol, componentes React, kanbans, calendarios
- `@.claude/agents/ai-engineer.md` — Claude API, prompts, generación de contenido, judge
- `@.claude/agents/integrations.md` — Meta, GBP, Drive, Telegram, Resend, crons, webhooks
- `@.claude/agents/reviewer.md` — Auditoría de seguridad pre-merge (solo lectura)

## Skills disponibles

- `@.claude/skills/supabase-rls.md` — Escribir y testear políticas RLS multi-rol
- `@.claude/skills/claude-generation.md` — Patrón estándar de llamadas a Claude API
- `@.claude/skills/meta-publishing.md` — Publicación Meta Graph API + retry exponencial
- `@.claude/skills/platform-adaptation.md` — Adaptación de copy por plataforma

## Documentación de referencia

- `@docs/architecture.md` — Arquitectura, integraciones externas, crons
- `@docs/content-lifecycle.md` — Los 12 estados detallados
- `@docs/brand-brain.md` — Estructura Brand Brain + uso en generación
- `@docs/security.md` — RLS por tabla, signed URLs, secrets
- `@docs/decisions.md` — ADRs: decisiones de arquitectura documentadas
- `@docs/database-schema.md` — Schema SQL completo
- `@docs/modules.md` — Spec detallada de todos los módulos
