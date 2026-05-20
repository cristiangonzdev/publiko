# Agency OS

Sistema operativo de una agencia de gestión de redes sociales: multi-rol (admin, editor, grabador, cliente), generación de contenido con Claude, coordinación de equipo, publicación automatizada en Meta y reporting semanal.

> Especificación completa en [`CLAUDE.md`](./CLAUDE.md) y en [`docs/`](./docs).

## Stack

- **Web:** Next.js 16 (App Router) + TypeScript + Tailwind CSS
- **Backend / DB / Auth / Storage:** Supabase
- **Orquestación:** n8n (self-hosted)
- **IA:** Anthropic Claude (`claude-sonnet-4-20250514`)
- **Publicación:** Meta Graph API, TikTok API
- **Email:** Resend · **Notif. internas:** Telegram

## Arrancar en local

```bash
cp .env.example .env.local   # rellenar credenciales
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Supabase

```bash
# (Opcional) levantar Supabase local con CLI
npx supabase start
npx supabase db reset           # aplica supabase/migrations/0001_init.sql
npx supabase gen types typescript --local > src/types/supabase.ts
```

Para entornos remotos: copiar/pegar `supabase/migrations/0001_init.sql` en el SQL Editor del dashboard.

## Estructura

```
.
├── CLAUDE.md
├── docs/                  # Spec del producto (brand-brain, schema, módulos, n8n)
├── src/
│   ├── app/               # Next.js App Router
│   │   ├── api/health/    # Healthcheck JSON
│   │   ├── dashboard/     # Panel multi-rol
│   │   ├── login/         # Stub de autenticación
│   │   └── page.tsx       # Landing
│   ├── lib/
│   │   ├── supabase/      # Clients (browser, server, middleware)
│   │   └── utils.ts       # cn() para Tailwind
│   ├── types/supabase.ts  # Placeholder (regenerar con CLI)
│   └── middleware.ts      # Auth gate por ruta
├── supabase/
│   ├── config.toml
│   └── migrations/        # 0001_init.sql
└── n8n/workflows/         # JSON exports de los workflows
```

## Roadmap MVP (4 semanas)

Resumen en `CLAUDE.md`. Estado: **scaffolding inicial completado**.
