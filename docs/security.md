# Seguridad — Publiko

Documento de referencia para las políticas de seguridad del sistema. Si una tarea contradice estas políticas, detente y documenta un ADR antes de proceder.

---

## RLS por tabla

La función helper `current_user_role()` es `security definer` y devuelve el rol del usuario autenticado actual:
```sql
create or replace function current_user_role()
returns user_role
language sql
stable
security definer
as $$
  select role from profiles where id = auth.uid()
$$;
```

### profiles
| Operación | Quién puede |
|-----------|-------------|
| SELECT | Propio perfil (`id = auth.uid()`) o admin |
| UPDATE | Propio perfil o admin |
| INSERT | Solo via trigger de auth (no directo) |
| DELETE | Solo admin (soft delete recomendado) |

### clients
| Operación | Quién puede |
|-----------|-------------|
| ALL | admin |
| SELECT | editor donde `assigned_editor_id = auth.uid()` |
| SELECT | grabador donde `assigned_grabador_id = auth.uid()` |
| SELECT | cliente donde `client_user_id = auth.uid()` |

### brand_brains
| Operación | Quién puede |
|-----------|-------------|
| ALL | admin |
| SELECT | cliente cuyo cliente tiene `client_user_id = auth.uid()` (via subquery en `clients`) |

### content_tasks
| Operación | Quién puede |
|-----------|-------------|
| ALL | admin |
| SELECT | editor donde `editor_id = auth.uid()` |
| SELECT | grabador donde `grabador_id = auth.uid()` |
| SELECT | cliente via subquery `clients.client_user_id = auth.uid()` |

**Importante:** Editor y grabador solo tienen SELECT. Las mutaciones (UPDATE de status, bruto_asset_ids, etc.) se hacen desde API routes que usan `createServiceClient()` — después de verificar que el usuario autenticado es el asignado a esa tarea.

### content_ideas
| Operación | Quién puede |
|-----------|-------------|
| ALL | admin |
| SELECT | cliente via subquery `clients.client_user_id = auth.uid()` |

### posts
| Operación | Quién puede |
|-----------|-------------|
| ALL | admin |
| SELECT | cliente via subquery `clients.client_user_id = auth.uid()` |

### assets
| Operación | Quién puede |
|-----------|-------------|
| ALL | admin |
| SELECT | editor, grabador o cliente asignados al cliente (subquery sobre `clients`) |

### reviews
| Operación | Quién puede |
|-----------|-------------|
| ALL | admin |

### weekly_reports
| Operación | Quién puede |
|-----------|-------------|
| ALL | admin |
| SELECT | cliente via subquery `clients.client_user_id = auth.uid()` |

### crm_activities
| Operación | Quién puede |
|-----------|-------------|
| ALL | admin solamente |

### invoices
| Operación | Quién puede |
|-----------|-------------|
| ALL | admin |
| SELECT | cliente via subquery `clients.client_user_id = auth.uid()` |

### notifications
| Operación | Quién puede |
|-----------|-------------|
| SELECT | Propio usuario (`user_id = auth.uid()`) o admin |
| INSERT | Solo via `createServiceClient()` (desde API routes — el usuario no se inserta notificaciones a sí mismo) |

### client_performance_baselines
| Operación | Quién puede |
|-----------|-------------|
| ALL | admin |
| SELECT | cliente via subquery `clients.client_user_id = auth.uid()` |

### winning_patterns
| Operación | Quién puede |
|-----------|-------------|
| ALL | admin |
| SELECT | cliente via subquery `clients.client_user_id = auth.uid()` |

---

## Regla de oro: nueva tabla → RLS inmediato

Al crear cualquier tabla nueva en una migración, incluir siempre:
```sql
ALTER TABLE nueva_tabla ENABLE ROW LEVEL SECURITY;

-- Al menos una policy, aunque sea solo admin:
CREATE POLICY "nueva_tabla: admin full" ON nueva_tabla
  FOR ALL USING (current_user_role() = 'admin')
  WITH CHECK (current_user_role() = 'admin');
```

Una tabla sin RLS permite que cualquier usuario autenticado lea todos sus datos.

---

## Política de signed URLs

**Regla:** Ningún asset se sirve con URL pública permanente.

**Implementación:**
- `src/lib/upload/signed-upload.ts` genera signed URLs para uploads (lado cliente sube directamente a Storage, el servidor solo firma)
- Para descargas, el servidor genera signed URLs con TTL corto (ej. 3600s) en el momento de la request
- El bucket `assets` en Supabase debe estar configurado como **privado** (sin acceso público anónimo)

**Lo que NO se debe hacer:**
```typescript
// MAL: URL pública permanente
const { data } = supabase.storage.from('assets').getPublicUrl(path)
return data.publicUrl  // cualquiera puede acceder si conoce el path

// BIEN: signed URL que expira
const { data, error } = await supabase.storage
  .from('assets')
  .createSignedUrl(path, 3600)  // 1 hora
return data?.signedUrl
```

---

## Variables de entorno: públicas vs privadas

| Variable | Prefijo | Llega al browser | Uso |
|----------|---------|-----------------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | `NEXT_PUBLIC_` | Sí | Supabase client en browser |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `NEXT_PUBLIC_` | Sí | Supabase anon client |
| `NEXT_PUBLIC_APP_URL` | `NEXT_PUBLIC_` | Sí | Construcción de URLs en emails |
| `SUPABASE_SERVICE_ROLE_KEY` | — | **No** | Bypass RLS en server |
| `ANTHROPIC_API_KEY` | — | **No** | Claude API |
| `META_APP_ID` | — | **No** | Meta Graph API |
| `META_APP_SECRET` | — | **No** | Meta Graph API |
| `GOOGLE_CLIENT_ID` | — | **No** | Google OAuth |
| `GOOGLE_CLIENT_SECRET` | — | **No** | Google OAuth |
| `GOOGLE_REFRESH_TOKEN` | — | **No** | Google APIs |
| `GOOGLE_DRIVE_ROOT_FOLDER_ID` | — | **No** | Drive |
| `TELEGRAM_BOT_TOKEN` | — | **No** | Telegram Bot |
| `TELEGRAM_ADMIN_CHAT_ID` | — | **No** | Canal Telegram admin |
| `RESEND_API_KEY` | — | **No** | Email |
| `CRON_SECRET` | — | **No** | Auth de cron endpoints |
| `WEBHOOK_SECRET` | — | **No** | Auth de webhook endpoints |

**Regla:** Si una variable no tiene prefijo `NEXT_PUBLIC_`, nunca puede aparecer en un Client Component, en `use client`, ni en ningún archivo que se importe desde el browser.

---

## Auth checks en API routes

Toda route que modifique datos o devuelva datos sensibles debe verificar:

### Patrón para rutas de admin
```typescript
import { getAuthUser } from '@/lib/auth/getUser'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { user, role } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  // lógica de negocio...
}
```

### Patrón para rutas de equipo (grabador/editor)
```typescript
const { user, role } = await getAuthUser()
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
if (role !== 'grabador' && role !== 'admin') {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
// Verificar además que la tarea esté asignada a este usuario:
const task = await supabase.from('content_tasks').select('grabador_id').eq('id', taskId).single()
if (task.data?.grabador_id !== user.id && role !== 'admin') {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
```

### Patrón para crons
```typescript
const authHeader = request.headers.get('authorization')
if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
// No hay usuario autenticado; usar createServiceClient() para DB
```

### Patrón para webhooks internos
```typescript
const secret = request.headers.get('x-webhook-secret')
if (secret !== process.env.WEBHOOK_SECRET) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

---

## `createServiceClient()` — cuándo usarlo

`createServiceClient()` en `src/lib/supabase/server.ts` crea un cliente Supabase con `SERVICE_ROLE_KEY` que **bypasea RLS completamente**.

Usar SOLO en:
- Cron jobs (`/api/cron/*`)
- Webhooks internos (`/api/webhooks/*`)
- Operaciones de admin que necesitan insertar en tablas de otro usuario (ej. crear notificación para el grabador)
- Operaciones que RLS bloquearía correctamente pero el rol necesita hacer por diseño (ej. admin crea perfil de un nuevo editor)

**NUNCA usar en:**
- Rutas accesibles por clientes, editores o grabadores
- Client Components
- Cualquier route donde los datos devueltos dependan del usuario autenticado

---

## Checklist de seguridad pre-merge

Antes de hacer merge de cualquier branch que toque la base de datos o las API routes:

- [ ] Toda tabla nueva tiene `ALTER TABLE x ENABLE ROW LEVEL SECURITY`
- [ ] Toda tabla nueva tiene al menos una policy
- [ ] No hay `getPublicUrl()` de Supabase Storage sin pasar por signed URL
- [ ] Toda API route que modifica datos tiene `getAuthUser()` al principio
- [ ] Toda API route de cron valida `CRON_SECRET`
- [ ] No hay variables privadas (sin `NEXT_PUBLIC_`) importadas en Client Components
- [ ] `createServiceClient()` solo se usa en crons, webhooks o admin actions verificadas

Para ejecutar este checklist con Claude Code: usa `/security-check`.
