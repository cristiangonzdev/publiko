# /security-check

Auditoría de seguridad completa del código de Publiko usando el agente reviewer.

## Uso

```
/security-check
/security-check [ruta específica o descripción del área a auditar]
```

Ejemplos:
```
/security-check
/security-check src/app/api/tasks/
/security-check todos los cron jobs
```

---

## Qué audita

El agente `@.claude/agents/reviewer.md` revisa:

### RLS (Row Level Security)
- Todas las tablas tienen `ENABLE ROW LEVEL SECURITY`
- Cada tabla tiene políticas para los roles que necesitan acceso
- No hay tablas recién creadas sin policies
- `createServiceClient()` no se usa donde debería usarse `createClient()`

### Assets y Storage
- No hay `getPublicUrl()` de Supabase Storage sin signed URL
- Los signed URLs tienen TTL
- `storage_path` no se expone directamente al frontend

### Auth en API routes
- Toda route que modifica datos verifica usuario autenticado
- Todos los cron endpoints validan `CRON_SECRET`
- Todos los webhook endpoints validan `WEBHOOK_SECRET`
- Los roles se verifican explícitamente
- Las routes de grabador/editor verifican que la tarea está asignada a ese usuario

### Secrets
- Sin variables privadas en Client Components
- Sin tokens hardcodeados
- `createServiceClient()` solo en lugares autorizados

### Claude API
- `stripMarkdown()` antes de `JSON.parse()` en respuestas de Claude
- Enums sanitizados antes de INSERT
- Modelo es `claude-sonnet-4-6`

---

## Formato del reporte

El reviewer devuelve problemas clasificados como:

**CRÍTICO** — Vulnerabilidad explotable inmediatamente. Bloquea merge.
**ALTO** — Vulnerabilidad probable bajo condiciones específicas. Bloquea merge.
**MEDIO** — Mala práctica que puede derivar en problema. Resolver antes del siguiente release.
**BAJO** — Code smell de seguridad. Nice to have.

---

## Cuándo ejecutarlo

- Antes de hacer merge a main de cualquier branch con cambios en API routes, migraciones SQL o integraciones externas
- Periódicamente (cada 2-4 semanas) sobre el codebase completo
- Tras añadir una integración nueva
- Tras modificar el sistema de autenticación o middleware
