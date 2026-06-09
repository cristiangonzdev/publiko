# /new-feature

Flujo guiado de 3 fases para implementar cualquier feature nueva en Publiko: diseño → implementación → revisión de seguridad.

## Uso

```
/new-feature [descripción de la feature]
```

Ejemplo:
```
/new-feature Panel de métricas de engagement por cliente con gráficas semanales
```

---

## Fase 1: Diseño (architect)

**Agente:** `@.claude/agents/architect.md`

El architect explora el estado actual del código y diseña:

1. **Schema de DB** (si aplica): tabla nueva o columnas adicionales, con migración SQL completa incluyendo RLS
2. **Contratos de API**: request/response shape para cada endpoint necesario, con validaciones Zod y auth pattern
3. **Estructura de componentes**: qué páginas/componentes crear, Server vs Client, jerarquía de props
4. **ADR** (si la decisión es significativa): borrador para `docs/decisions.md`

El architect presenta el diseño. **Esperar aprobación del usuario antes de continuar.**

---

## Fase 2: Implementación

Según el tipo de feature, lanzar el agente correspondiente (o ambos en paralelo):

- Features de backend (API routes, RPCs, lógica de negocio) → `@.claude/agents/backend-dev.md`
- Features de frontend (páginas, componentes, formularios) → `@.claude/agents/frontend-dev.md`
- Features de IA (Claude, prompts, generación) → `@.claude/agents/ai-engineer.md`
- Features de integración (Meta, GMB, Drive, Telegram, crons) → `@.claude/agents/integrations.md`

Los agentes de backend y frontend pueden trabajar en paralelo si sus cambios no se solapan.

---

## Fase 3: Revisión de seguridad

**Agente:** `@.claude/agents/reviewer.md`

Antes de hacer commit o push, el reviewer audita:

- RLS en tablas nuevas o modificadas
- Auth checks en API routes nuevas
- Signed URLs en accesos a assets
- Secrets no expuestos
- `CRON_SECRET` / `WEBHOOK_SECRET` en nuevos endpoints de cron/webhook

El reviewer devuelve un reporte con problemas encontrados (CRÍTICO/ALTO/MEDIO/BAJO). Los problemas CRÍTICOS y ALTO deben resolverse antes del merge. MEDIO y BAJO son opcionales pero recomendados.

---

## Checklist final

Antes de marcar la feature como lista:

- [ ] `npm run build` pasa sin errores (no solo `tsc --noEmit`)
- [ ] Nueva migración SQL aplicada en Supabase dashboard (si aplica)
- [ ] Variables de entorno nuevas añadidas a Vercel (si aplica)
- [ ] Nuevo cron añadido a `vercel.json` (si aplica)
- [ ] Reviewer ha dado el OK o los problemas CRÍTICO/ALTO han sido resueltos
