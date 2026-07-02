# Architecture Decision Records (ADRs)

Registro de decisiones de arquitectura significativas. Cada ADR documenta el contexto, la decisión y las alternativas descartadas.

---

## Plantilla

```markdown
## ADR-NNN: Título de la decisión

**Estado:** Propuesto | Aceptado | Obsoleto | Sustituido por ADR-XXX
**Fecha:** YYYY-MM-DD

### Contexto
Qué problema o necesidad motiva esta decisión.

### Decisión
Qué se ha decidido hacer.

### Alternativas consideradas
- Alternativa A: por qué no
- Alternativa B: por qué no

### Consecuencias
Qué implica esta decisión (trade-offs, limitaciones futuras, trabajo derivado).
```

---

## ADR-001: Stack tecnológico

**Estado:** Aceptado
**Fecha:** 2025-05-01

### Contexto
Agencia de social media necesita un sistema de gestión de contenido multi-rol (admin, grabador, editor, cliente). Debe integrar IA generativa, publicación en redes sociales, almacenamiento de vídeo y notificaciones. El equipo es pequeño (1-2 devs) y el tiempo de entrega es corto.

### Decisión
- **Frontend + Backend:** Next.js 16 App Router con TypeScript estricto. Un solo repositorio, deploy en Vercel.
- **Base de datos + Auth + Storage:** Supabase (PostgreSQL 15). RLS para seguridad multi-tenant.
- **IA generativa:** Anthropic Claude API (`claude-sonnet-4-6`). Capacidad de seguir instrucciones complejas de brand.
- **Publicación social:** Meta Graph API v21.0 para IG + FB. Google Business Profile API para GMB.
- **Assets de vídeo:** Supabase Storage (uploads <50 MB frecuentes) + Google Drive (vídeos de producción grandes).
- **Notificaciones equipo:** Telegram Bot API (sin fricción de onboarding para freelancers).
- **Email cliente:** Resend (simple, sin configuración de servidor propio).
- **Crons:** Vercel Cron Jobs (integrado, sin infraestructura adicional).

### Alternativas consideradas
- **Supabase vs PlanetScale/Neon:** Supabase ganó por Storage integrado + Auth + RLS + RPCs en un solo servicio.
- **Claude vs GPT-4o:** Claude tiene mejor seguimiento de instrucciones de estilo/voz, crítico para brand voice.
- **n8n vs Vercel Crons:** n8n requería VPS autogestionado. Vercel Crons es suficiente para 4 tareas bien definidas.
- **Telegram vs Slack:** Telegram no requiere cuenta corporativa para freelancers externos.

### Consecuencias
- Lock-in a Supabase para auth + storage. Migrar sería costoso.
- Vercel Crons tiene límite de 12 crons en plan Hobby. Pro permite más.
- Meta Graph API requiere revisión de app para producción (proceso de semanas).

---

## ADR-002: Publicación nunca automática sin OK del admin

**Estado:** Aceptado
**Fecha:** 2025-05-10

### Contexto
Se construyó un sistema de `approval_tier = 'auto'` donde Claude genera ideas y un juez (`judgeContent()`) las aprueba automáticamente si pasan la evaluación. La pregunta era si el pipeline podía llegar hasta publicación sin intervención humana.

### Decisión
**La publicación siempre requiere un paso manual del admin:** elegir plataformas y hora de publicación. Aunque `approval_tier = 'auto'` puede llevar una tarea hasta `status = 'approved'`, el admin debe crear los `posts` con `scheduled_at` explícitamente.

El toggle `auto_publish` existe en el código pero su **default es OFF** y no se activa sin decisión explícita por cliente.

### Alternativas consideradas
- **Publicación totalmente automática:** Posible técnicamente, pero un error de marca publicado en Instagram es un problema grave para el cliente. El riesgo supera el beneficio.
- **Auto-publish con delay de 24h y ventana de cancelación:** Más complejo de implementar; no justificado en MVP.

### Consecuencias
- El admin es siempre el último filtro antes de publicar.
- Si el admin no revisa, el contenido no se publica (no hay acumulación sin control).
- El juez de Claude (`judgeContent`) sirve para reducir el trabajo del admin (menos rechazos manuales), no para eliminarlo.

---

## ADR-003: Signed URLs para todos los assets

**Estado:** Aceptado
**Fecha:** 2025-05-10

### Contexto
Los assets (brutos de vídeo, entregables) son privados y pertenecen a un cliente específico. Necesitan ser accesibles por el grabador, el editor y el admin asignado, pero no por otros clientes ni por el público general.

### Decisión
**Ningún asset se expone con URL pública permanente.** Toda descarga o visualización de un archivo en Supabase Storage se hace via signed URL con TTL corto, generada en el servidor a través de `src/lib/upload/signed-upload.ts`.

El campo `assets.public_url` puede tener una URL de Supabase pero nunca debe usarse directamente en el frontend — siempre se regenera una signed URL en el momento de acceso.

### Alternativas consideradas
- **Bucket público:** Más simple de implementar, pero cualquiera con el path del archivo podría acceder. Inadmisible para vídeos de clientes.
- **Proxied through Next.js API route:** Posible pero introduce latencia y límite de 4.5 MB de Vercel para response bodies. Las signed URLs de Supabase Storage bypasean esto.

### Consecuencias
- Las signed URLs expiran. Si un usuario intenta acceder después del TTL, recibirá error 400. El frontend debe regenerar la URL al recargar.
- El bucket debe estar configurado como privado en Supabase (no público por defecto).
- El `SERVICE_ROLE_KEY` o el token del usuario autenticado es necesario para generar signed URLs.

---

## ADR-004: Haiku para tareas de scoring/clasificación

**Estado:** Aceptado
**Fecha:** 2026-06-09

### Contexto
El pipeline usaba `claude-sonnet-4-6` para todas las llamadas a Claude, incluidas tareas que no son creativas sino de evaluación contra una rúbrica fija: el juez de contenido (`judgeContent`), la generación de geo-queries (`generateGeoQueries`) y los borradores de respuesta a reseñas (`generateReviewResponse`). Estas llamadas se ejecutan con alta frecuencia (el juez en cada idea, las geo-queries y reseñas de forma recurrente vía cron), lo que las convierte en un coste recurrente significativo.

### Decisión
**Las tareas de scoring/clasificación pasan a `claude-haiku-4-5-20251001`:**
- `judgeContent` — evaluación pasa/no-pasa contra rúbrica.
- `generateGeoQueries` — enumeración de queries para snapshots de visibilidad IA.
- `generateReviewResponse` — respuesta a reseña siguiendo plantilla/tono fijos.

**La generación creativa se mantiene en `claude-sonnet-4-6`:** ideas (`generateWeeklyIdeas`, `generateDailyBatch`), copies (`generateCopyOptions`, `generateCopiesPerPlatform`), briefs (`generateBriefs`), refinamiento de Brand Brain (`generateBrainRefinementProposal`) e informes.

### Alternativas consideradas
- **Todo en Sonnet (statu quo):** Calidad uniforme pero coste innecesariamente alto en tareas donde Haiku rinde igual.
- **Todo en Haiku:** Descartado — la generación creativa (voz de marca, ideas) sí se degrada con un modelo más pequeño.

### Consecuencias
- Haiku es ~3× más barato que Sonnet; el ahorro es notable dado el volumen de llamadas de scoring.
- En tareas de rúbrica/clasificación Haiku rinde de forma equivalente, sin pérdida de calidad observable.
- Hay que vigilar dos IDs de modelo en el código. Cualquier cambio de modelo creativo sigue requiriendo actualizar la nota de `CLAUDE.md` (`claude-sonnet-4-6`).

---

## ADR-005: Facturación — PDF en browser, bucket privado y numeración secuencial por organización

**Estado:** Aceptado
**Fecha:** 2026-06-11

### Contexto
La tabla `invoices` existía desde 0001 pero solo soportaba un importe plano (`amount integer`, euros) generado por `generate-monthly`, sin desglose fiscal ni PDF (la columna `pdf_url` nunca se rellenaba). Se necesita facturación real: datos fiscales de agencia y cliente, líneas con IGIC/IRPF, PDF descargable y envío por email y WhatsApp.

### Decisión
- **Extensión, no sustitución:** `invoices` gana `lines jsonb`, `subtotal/tax_amount/irpf_amount numeric(10,2)`, `notes`, `sent_at`, `created_by` (migration 0016). `amount` se conserva y se sincroniza con `round(total)` al guardar — el código existente (KPIs, marcar pagada) no se toca.
- **PDF generado en el browser** con `@react-pdf/renderer` (importado siempre con `dynamic`/`import()` — no es SSR-safe) y subido al **bucket privado `invoices`** (0017). `pdf_url` guarda el *path* de Storage, nunca una URL: la visualización firma bajo demanda (TTL 1h), el email adjunta el PDF (Resend `attachments`) y WhatsApp recibe una signed URL de 7 días. Coherente con ADR-003.
- **Numeración secuencial atómica** vía RPC `next_invoice_number()`: `UPDATE agency_settings SET next_invoice_number = next_invoice_number + 1 … RETURNING` (row lock → sin carreras). Formato `{prefix}-{YYYY}-{NNNN}`, disjunto del formato legado `INV-YYYY-MM-XXXXXX` → coexisten bajo el mismo UNIQUE. El dedupe de `generate-monthly` pasa de número determinista a `client_id + invoice_type + period_start`.
- **Totales siempre recalculados server-side** (`src/lib/invoices/totals.ts`, única fuente del cálculo); del cliente solo se aceptan las líneas.
- **Evolution API opcional:** vars `EVOLUTION_*` como `optional()` en env.ts; sin configurar, el endpoint de WhatsApp devuelve 503 con mensaje claro.

### Alternativas consideradas
- **PDF server-side (puppeteer/pdfkit):** más control pero binarios pesados en serverless y cold starts; react-pdf en browser es suficiente para una factura.
- **URL pública para el PDF:** más simple, pero una factura contiene NIF, IBAN e importes — viola la regla nº2 de seguridad del proyecto.
- **Numeración determinista por cliente+mes (statu quo):** colisiona con la numeración legal correlativa que exige una serie por agencia.

### Consecuencias
- El KPI "Por cobrar" pasa a incluir IGIC (`amount` = total con impuestos) para las facturas nuevas.
- Las facturas legadas (sin líneas) se pueden marcar como pagadas pero no generan PDF.
- Sin `agency_settings` no se puede facturar: la UI redirige a la página de ajustes de agencia.

---

## ADR-006: Multi-agencia — org seed con UUID fijo, RLS por capa y aislamiento en service client

**Estado:** Aceptado
**Fecha:** 2026-06-11

### Contexto
Dos agencias conocidas (Logika Digital + una segunda) van a usar Publiko con aislamiento total. No es SaaS público: acceso controlado, sin billing por plan. El sistema era single-agency: todas las tablas colgaban de `clients` y las policies de admin daban acceso global.

### Decisión
- **Tabla `organizations`** (0018) con **seed determinista** `a0000000-0000-4000-8000-000000000001` = "Logika Digital". El backfill de todos los datos existentes se hace **en la migration** (no en la página de setup): es lo que hace 0018 compatible con el código wave-A ya desplegado.
- **`organization_id` solo en tablas raíz** (`profiles`, `clients`, `invoices`, `agency_settings`) con **DEFAULT transicional** a la seed y NOT NULL. Las 12 tablas hijas heredan la org vía join a `clients`. `invoices` lo lleva directo para simplificar RLS y la numeración por org (`UNIQUE(organization_id, invoice_number)`).
- **RLS por capa** (0019): solo se reescriben las policies de admin añadiendo `organization_id = get_my_org_id()` (directo o vía EXISTS a clients); las policies por rol (editor/grabador/cliente) no se tocan — ya son single-user y la app valida que las asignaciones no crucen orgs. `get_my_org_id()` es SECURITY DEFINER (mismo mecanismo sin recursión que `current_user_role()`).
- **Doble capa obligatoria:** RLS no protege los paths con `createServiceClient()`. Los guards centrales (`requireClientAccess`, `requireTaskAccess`, `requireInvoiceAccess`) verifican la org también para admin, y toda ruta/server action con service client filtra o verifica `organization_id` explícitamente. Crons y webhooks (CRON_SECRET + service role) siguen siendo org-agnósticos por diseño.
- **Invitaciones sin tabla `invites`:** se reutiliza el POST de usuarios existente (password temporal mostrada al admin), que ahora asigna la org del creador. `inviteUserByEmail` queda descartado por ahora (YAGNI).
- **RPCs org-aware con firma compatible:** `get_mrr_total()` y `get_upcoming_renewals()` filtran por org para admin y siguen siendo globales para service_role (crons intactos).

### Alternativas consideradas
- **Backfill en runtime durante el setup:** dejaría una ventana en la que el código viejo inserta filas sin org; la migration con seed la elimina.
- **`organization_id` en todas las tablas:** más índices y migraciones sin beneficio — el join a clients es barato (PK + idx_clients_org) y más difícil de desincronizar.
- **Confiar solo en RLS:** insuficiente: ~50 archivos usan service client.

### Consecuencias
- Código futuro que inserte en tablas raíz sin `organization_id` cae silenciosamente en la org seed — aceptado como transición; una migration futura (0020+) puede retirar los DEFAULT cuando wave B esté estabilizada.
- La org 2 se crea manualmente (SQL con service role) DESPUÉS de desplegar wave B, junto con su primer admin.
- Aislamiento verificable con `scripts/test-rls.mjs` (2 orgs de prueba + cleanup, exit 1 si falla).
- El admin ya no ve notificaciones de otros usuarios (la campana siempre fue por usuario).

---

## ADR-007: Detección de tendencias virales (Virlo) — workspace por org, cap por cliente, gate de concurrencia separado del gate de presupuesto

**Estado:** Propuesto
**Fecha:** 2026-07-02

### Contexto

Se evalúa integrar Virlo (dev.virlo.ai) como fuente de tendencias TikTok/Reels/Shorts, con una capa de Claude encima que convierte tendencias detectadas en briefs personalizados por Brand Brain. Virlo cobra por workspace/créditos. Publiko es multi-agencia desde ADR-006 (`organizations`), y el modelo de coste tiene que decidir dos cosas independientes: cuántos workspaces de Virlo se contratan (unidad de facturación externa) y cómo se reparte/limita el consumo interno entre clientes de una misma agencia (unidad de control interno). Confundir ambas lleva a dos fallos distintos: (a) un cliente ruidoso deja sin cuota a los demás de su agencia, (b) el cron dispara llamadas en paralelo hacia el mismo workspace y provoca throttling/429 de Virlo para todos los clientes de esa agencia a la vez, aunque cada uno individualmente esté dentro de su presupuesto.

### Decisión

**Unidad de contratación:** 1 workspace de Virlo por `organizations.id` (no por cliente, no global). Credenciales del workspace en una tabla nueva `organization_integrations` (o columna en `agency_settings`, a decidir en la migración) — no en `clients`, porque el workspace es de la agencia, no del negocio final.

**Unidad de control de coste — cap duro mensual por cliente**, independiente de cuántos workspaces existan por debajo:

```sql
alter table clients add column trend_detection_config jsonb default '{}';
-- { "enabled": true, "monthly_credit_budget": 200, "keywords": [...], "platforms": [...] }

create table trend_scan_usage (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  month date not null,                          -- primer día del mes
  credits_used integer not null default 0,
  scans_count integer not null default 0,
  budget_exhausted_notified_at timestamptz,      -- dedupe del aviso; null = aún no agotado o no avisado
  updated_at timestamptz not null default now(),
  unique(client_id, month)
);
```

El cron gatea por `credits_used < monthly_credit_budget * 0.9` (margen del 90%, ver ADR sobre el riesgo de carrera post-respuesta) **antes** de llamar a Virlo, e incrementa `credits_used` **después** de recibir respuesta (nunca antes — evita perder cuota por llamadas fallidas).

**Unidad de concurrencia — gate separado del cap de presupuesto**, porque el ToS de Virlo limita rate/llamadas simultáneas por workspace, no por cliente. El cron agrupa los clientes elegibles por `organization_id` y aplica concurrencia en dos niveles:
- Orgs en paralelo con `ORG_CONCURRENCY` (workspaces distintos, sin límite compartido entre ellos — mismo valor que `CLIENT_CONCURRENCY=5` de `daily-generation`).
- Clientes de la **misma** org acotados a `WORKSPACE_CONCURRENCY` (arranca en 2, conservador — a ajustar cuando se conozcan los límites reales publicados por Virlo, hoy desconocidos) vía un segundo `mapLimit` anidado, semáforo en memoria dentro de la misma invocación del cron. No hay lock entre invocaciones distintas (mismo trade-off aceptado que en `daily-generation`/`publish-retry`) — el margen del 90% en el cap de crédito absorbe el solape ocasional, no lo elimina.

**Comportamiento al agotar el cap a mitad de mes** — nunca un salto silencioso:
1. En el tick que cruza el umbral (`credits_used` pasa de `< budget*0.9` a `>= budget*0.9`), si `budget_exhausted_notified_at is null`: INSERT en `notifications` (channel='in_app', type='trend_budget_exhausted', data={client_id, business_name}) para cada admin de la org, y una llamada `notifyAdmin()` (Telegram) — y se setea `budget_exhausted_notified_at = now()`.
2. Ticks siguientes del mismo mes: el cliente se salta en el `eligible` filter (mismo patrón que hoy filtra por `daily_generation_config` vacío), sin re-notificar — la señal persistente es la fila en `notifications` (con `read_at`, no desaparece como el scroll de Telegram) y no un log de Vercel.
3. La ficha del cliente en `/admin/clients/[id]` lee `trend_scan_usage` del mes en curso y muestra un banner ("Presupuesto de tendencias agotado — se reactiva el 1 de [mes]") mientras `credits_used >= budget`. Sin esto, la única forma de enterarse sería releer notificaciones antiguas.
4. `month` en `trend_scan_usage` resetea el contador de forma natural (fila nueva cada mes, no hay job de reset) — `budget_exhausted_notified_at` también empieza en `null` cada mes, así que el aviso se repite si el cliente vuelve a agotar cuota el mes siguiente.

### Alternativas consideradas
- **1 workspace por cliente:** aislamiento de coste perfecto pero obliga a gestionar credenciales de Virlo por cada `clients.id` y multiplica el número de contratos — descartado hasta que un cliente concreto lo justifique económicamente.
- **1 workspace global para todo Publiko:** máxima economía de créditos pero cero aislamiento entre agencias — inadmisible en un sistema multi-tenant donde cada organización es un cliente de pago independiente de la agencia.
- **Un único gate (solo presupuesto, sin gate de concurrencia):** es lo que se iba a implementar antes de esta revisión. Insuficiente: un cliente dentro de su cap individual puede seguir disparando 429 de Virlo para toda su organización si el cron no acota la concurrencia por workspace.
- **Notificar en cada tick mientras el cliente esté agotado:** genera ruido (spam de Telegram/in-app cada vez que corre el cron) sin información nueva — se descarta a favor de notificar una vez por ciclo de agotamiento vía `budget_exhausted_notified_at`.

### Consecuencias
- Migrar un cliente a workspace dedicado más adelante es un cambio de aprovisionamiento (`organization_integrations`), no de schema de `trend_scan_usage` ni del cron — el cap por cliente sigue funcionando igual.
- `WORKSPACE_CONCURRENCY=2` es una suposición conservadora sin datos reales de rate limit de Virlo; hay que revisarlo en cuanto se contrate el primer workspace real y se conozcan los límites documentados.
- El margen del 90% en el cap y la ausencia de lock entre invocaciones del cron significan que un pico de solape puede hacer que el gasto real supere ligeramente el `monthly_credit_budget` configurado — aceptado como riesgo residual, no eliminado.
- Trabajo derivado: migración concreta (`architect`), cron `trend-scan` + gate de concurrencia/presupuesto (`backend-dev`/`integrations`), banner en ficha de cliente (`frontend-dev`), generación de brief desde tendencia vía Claude (`ai-engineer`, en un paso separado del scan para no acoplar rate limits de Virlo y Anthropic).
