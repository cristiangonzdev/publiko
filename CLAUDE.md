# Agency OS — Social Media Agency Platform

## Qué es este proyecto

Sistema operativo completo para una agencia de gestión de redes sociales. Permite gestionar múltiples clientes, generar contenido con IA, coordinar grabadores y editores, publicar automáticamente y reportar resultados. Ticket mínimo: €900/mes por cliente.

## Stack técnico

- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend/DB:** Supabase (PostgreSQL, Auth, Storage, RPC)
- **Orquestación:** n8n (self-hosted en Hetzner VPS)
- **IA:** Anthropic Claude API (claude-sonnet-4-20250514)
- **Publicación:** Meta Graph API (IG + FB), TikTok API
- **Almacenamiento vídeo:** Google Drive API
- **Notificaciones:** Telegram Bot API
- **Email:** Resend

## Arquitectura general

```
Next.js (dashboard multi-rol)
    ↕ Supabase (DB + Auth + Storage)
    ↕ n8n (workflows de orquestación)
         ↕ Claude API (generación de contenido)
         ↕ Meta Graph API (publicación)
         ↕ Google Drive API (assets de vídeo)
         ↕ Telegram Bot (notificaciones)
```

## Roles del sistema

| Rol | Acceso |
|---|---|
| `admin` | Todo. CRM, aprobación, configuración, ingresos |
| `grabador` | Solo tareas de grabación asignadas + subida de brutos |
| `editor` | Solo tareas de edición + descarga brutos + subida entregables |
| `cliente` | Solo su contenido, calendario, métricas y banco de assets |

## Estructura de carpetas del proyecto

```
/
├── CLAUDE.md                    ← Estás aquí
├── docs/
│   ├── brand-brain.md           ← Spec completa del Brand Brain
│   ├── database-schema.md       ← Schema SQL completo de Supabase
│   ├── modules.md               ← Spec de todos los módulos
│   ├── n8n-workflows.md         ← Todos los workflows de n8n
│   └── api-integrations.md      ← Meta API, Drive, Telegram
├── src/
│   ├── app/                     ← Next.js App Router
│   │   ├── (admin)/             ← Rutas del admin
│   │   ├── (editor)/            ← Rutas del editor
│   │   ├── (grabador)/          ← Rutas del grabador
│   │   ├── (cliente)/           ← Portal del cliente
│   │   └── api/                 ← API Routes de Next.js
│   ├── components/
│   │   ├── ui/                  ← Componentes base
│   │   ├── brand-brain/         ← Formularios brand brain
│   │   ├── content/             ← Pipeline de contenido
│   │   ├── editor/              ← Workspace editor
│   │   └── crm/                 ← Panel admin CRM
│   ├── lib/
│   │   ├── supabase/            ← Client, server, types
│   │   ├── claude/              ← Claude API helpers
│   │   ├── meta/                ← Meta Graph API helpers
│   │   └── drive/               ← Google Drive helpers
│   └── types/                   ← TypeScript types globales
├── supabase/
│   └── migrations/              ← Migraciones SQL
└── n8n/
    └── workflows/               ← JSON exports de workflows n8n
```

## Variables de entorno requeridas

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Claude API
ANTHROPIC_API_KEY=

# Meta Graph API
META_APP_ID=
META_APP_SECRET=
META_SYSTEM_USER_TOKEN=

# Google Drive
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=
GOOGLE_DRIVE_ROOT_FOLDER_ID=

# Telegram
TELEGRAM_BOT_TOKEN=
TELEGRAM_ADMIN_CHAT_ID=

# Resend (email)
RESEND_API_KEY=

# n8n webhook base
N8N_WEBHOOK_BASE_URL=
N8N_API_KEY=
```

## Convenciones de código

- TypeScript estricto en todo el proyecto
- Supabase RPC para lógica compleja de DB (no queries inline en componentes)
- Server Components por defecto, Client Components solo donde necesario (interactividad)
- API Routes de Next.js como webhooks y endpoints internos
- n8n hace toda la orquestación background — Next.js no hace polling
- Claude API solo se llama desde n8n o desde API Routes de Next.js (nunca desde el cliente)
- Cero lógica de negocio en componentes — todo en `/lib`

## Orden de construcción (MVP en 4 semanas)

### Semana 1
- [ ] Setup Supabase: schema completo + auth + RLS policies
- [ ] Next.js: layout multi-rol con middleware de auth
- [ ] Brand Brain: formulario completo de onboarding de cliente
- [ ] Módulo de ideas: generación con Claude + deduplicación

### Semana 2
- [ ] Workspace del editor: kanban + subida de entregables
- [ ] Módulo grabador: vista de tareas + ficha técnica
- [ ] Google Drive: integración para brutos
- [ ] Notificaciones Telegram: grabador + editor

### Semana 3
- [ ] Meta Graph API: publisher automático
- [ ] Scheduler: n8n cron + publicación
- [ ] Panel admin CRM: MRR, clientes, pipeline
- [ ] Portal básico del cliente

### Semana 4
- [ ] Analytics harvest: Meta API → Supabase
- [ ] Informe PDF automático semanal al cliente
- [ ] Portal cliente completo
- [ ] Testing end-to-end con cliente real

## Comandos útiles

```bash
# Desarrollo
npm run dev

# Supabase local
npx supabase start
npx supabase db reset

# Generar tipos de Supabase
npx supabase gen types typescript --local > src/types/supabase.ts

# Push de migraciones
npx supabase db push
```

## Documentación de referencia

- Brand Brain completo: `docs/brand-brain.md`
- Schema de base de datos: `docs/database-schema.md`
- Todos los módulos: `docs/modules.md`
- Workflows n8n: `docs/n8n-workflows.md`
- APIs externas: `docs/api-integrations.md`
