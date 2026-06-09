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
