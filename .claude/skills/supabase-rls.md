# Skill: Supabase RLS multi-rol

Guía para escribir, aplicar y testear Row Level Security en Publiko. Lee `@docs/security.md` para la referencia completa de policies por tabla.

---

## Patrón base

Toda tabla nueva necesita estas 3 cosas en su migración:

```sql
-- 1. Habilitar RLS
ALTER TABLE nueva_tabla ENABLE ROW LEVEL SECURITY;

-- 2. Policy para admin (siempre la primera)
CREATE POLICY "nueva_tabla: admin full" ON nueva_tabla
  FOR ALL USING (current_user_role() = 'admin')
  WITH CHECK (current_user_role() = 'admin');

-- 3. Policies adicionales por rol (solo si el rol debe acceder)
CREATE POLICY "nueva_tabla: editor sees own" ON nueva_tabla
  FOR SELECT USING (
    current_user_role() = 'editor' AND editor_id = auth.uid()
  );
```

La función `current_user_role()` está definida en `0001_init.sql` como `security definer`.

---

## Patrón para acceso via FK (cliente ve lo suyo)

Cuando un rol solo puede ver filas relacionadas con su cliente:

```sql
CREATE POLICY "nueva_tabla: client reads own" ON nueva_tabla
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM clients c
      WHERE c.id = nueva_tabla.client_id
        AND c.client_user_id = auth.uid()
    )
  );
```

Usar este patrón en tablas que tienen `client_id` FK: `content_ideas`, `content_tasks`, `posts`, `assets`, `weekly_reports`, `invoices`, `winning_patterns`.

---

## Patrón para acceso compartido (editor + grabador + cliente)

Para tablas como `assets` donde múltiples roles del mismo cliente deben acceder:

```sql
CREATE POLICY "assets: team sees by client" ON assets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM clients c
      WHERE c.id = assets.client_id
        AND (
          c.assigned_editor_id = auth.uid()
          OR c.assigned_grabador_id = auth.uid()
          OR c.client_user_id = auth.uid()
        )
    )
  );
```

---

## `createClient()` vs `createServiceClient()`

En `src/lib/supabase/server.ts`:

```typescript
// Con RLS activo — usa las credenciales del usuario de la request
// Úsalo en Server Components y API routes normales
const supabase = createClient()

// Bypasea RLS completamente — usa SERVICE_ROLE_KEY
// Úsalo SOLO en: crons, webhooks, admin actions que necesitan operar en nombre de otro usuario
const supabase = createServiceClient()
```

Cuando usas `createServiceClient()` en una ruta que cualquier usuario puede llamar (ej. ruta de grabador), debes verificar manualmente los permisos antes:
```typescript
const { user, role } = await getAuthUser()
if (!user || role !== 'grabador') return forbidden()

// Verificar que la tarea está asignada a este usuario
const { data: task } = await createServiceClient()
  .from('content_tasks')
  .select('grabador_id')
  .eq('id', taskId)
  .single()

if (task?.grabador_id !== user.id) return forbidden()
// Ahora sí, operar con service client
```

---

## Testear RLS en Supabase SQL Editor

Para simular un usuario con un rol específico:

```sql
-- Simular que eres el usuario con este ID y rol
SET LOCAL request.jwt.claims = '{"sub": "uuid-del-usuario", "role": "authenticated"}';

-- Probar que el editor solo ve sus tareas
SELECT * FROM content_tasks;  -- debe devolver solo donde editor_id = 'uuid-del-usuario'

-- Probar que NO puede ver tareas de otro editor
SELECT * FROM content_tasks WHERE editor_id = 'uuid-de-otro-editor';  -- debe devolver vacío
```

O usar el cliente de Supabase JS con las credenciales del usuario de test:
```typescript
const supabase = createClient(url, anonKey, {
  global: { headers: { Authorization: `Bearer ${userJWT}` } }
})
```

---

## Errores comunes

**1. Policy solo en SELECT, olvidar INSERT/UPDATE**
Si un grabador necesita UPDATE (ej. marcar brutos listos), necesita su propia policy de UPDATE. Sin ella, el UPDATE falla silenciosamente o devuelve error 42501.
- Solución: Siempre pensar en qué operaciones necesita cada rol, no solo SELECT.

**2. Circular FK en policies**
Si la policy de tabla A hace JOIN a tabla B, y tabla B tiene policy que hace JOIN a tabla A → bucle infinito.
- Solución: Usar `SECURITY DEFINER` en la función helper o usar subquery simple sin JOIN circular.

**3. Olvidar `WITH CHECK` en policies de escritura**
`FOR ALL USING (condición)` sin `WITH CHECK (condición)` permite SELECT pero puede no proteger INSERT.
```sql
-- Correcto: include WITH CHECK para writes
CREATE POLICY "..." ON tabla FOR ALL
  USING (current_user_role() = 'admin')
  WITH CHECK (current_user_role() = 'admin');
```

**4. `current_user_role()` devuelve NULL**
Si el perfil del usuario no existe en la tabla `profiles` (usuario de auth sin perfil), la función devuelve NULL. Asegurarse de que el trigger de creación de perfil funciona al registrar usuarios.

---

## Añadir RLS a tabla existente sin policy

Si heredas una tabla sin RLS:
```sql
-- Primero habilitar
ALTER TABLE tabla_sin_rls ENABLE ROW LEVEL SECURITY;

-- Sin ninguna policy, nadie puede leer nada (modo denegación por defecto)
-- Añadir las policies necesarias antes de deploying
```
