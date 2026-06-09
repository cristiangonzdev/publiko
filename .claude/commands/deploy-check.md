# /deploy-check

Checklist completo pre-deploy para asegurar que Publiko puede desplegarse en Vercel sin romper nada.

## Uso

```
/deploy-check
```

---

## Checklist

### 1. Build local
```bash
npm run build
```
Vercel usa `next build` — más estricto que `tsc --noEmit`. Un build local que pasa garantiza que Vercel no fallará por:
- Variables `'use client'` no usadas
- Imports incorrectos
- Errores de TypeScript ignorados por el IDE

**Si el build falla:** resolver antes de continuar. No hay excepciones.

### 2. Migraciones SQL pendientes

Listar migraciones en `supabase/migrations/` que NO estén aplicadas en producción (Supabase dashboard).

**Cómo verificar:** Comparar el listado local de `supabase/migrations/` con el historial en Supabase dashboard → Database → Migrations.

**Si hay migraciones pendientes:** Aplicarlas en el Supabase dashboard antes del deploy. Vercel despliega el código pero **no aplica SQL automáticamente**. Un deploy sin la migración romperá cualquier query a columnas o tablas nuevas.

### 3. Variables de entorno en Vercel

Verificar que estas variables están configuradas en Vercel dashboard → Settings → Environment Variables:

```
NEXT_PUBLIC_SUPABASE_URL          ← Pública
NEXT_PUBLIC_SUPABASE_ANON_KEY     ← Pública
NEXT_PUBLIC_APP_URL               ← Pública

SUPABASE_SERVICE_ROLE_KEY         ← Privada
ANTHROPIC_API_KEY                 ← Privada
META_APP_ID                       ← Privada
META_APP_SECRET                   ← Privada
GOOGLE_CLIENT_ID                  ← Privada
GOOGLE_CLIENT_SECRET              ← Privada
GOOGLE_REFRESH_TOKEN              ← Privada
GOOGLE_DRIVE_ROOT_FOLDER_ID       ← Privada
TELEGRAM_BOT_TOKEN                ← Privada
TELEGRAM_ADMIN_CHAT_ID            ← Privada
RESEND_API_KEY                    ← Privada
CRON_SECRET                       ← Privada
WEBHOOK_SECRET                    ← Privada
```

**Si falta alguna:** El deploy puede pasar pero las funcionalidades afectadas fallarán en runtime.

### 4. Crons en vercel.json

Verificar que todos los crons están en `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/cron/cleanup-assets", "schedule": "0 3 * * *" },
    { "path": "/api/cron/daily-generation", "schedule": "0 6 * * *" },
    { "path": "/api/cron/publish-retry", "schedule": "*/15 * * * *" },
    { "path": "/api/cron/reviews-harvest", "schedule": "0 * * * *" }
  ]
}
```

Si se añadió un cron nuevo, verificar que está en `vercel.json` Y que el endpoint valida `CRON_SECRET`.

### 5. RLS activo en Supabase

En Supabase dashboard → Authentication → Policies: verificar que RLS está activo en todas las tablas. Especialmente si se aplicó una migración nueva con `ALTER TABLE x ENABLE ROW LEVEL SECURITY`.

**Truco rápido:** En el SQL Editor de Supabase ejecutar:
```sql
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```
Todos los `rowsecurity` deben ser `true`.

### 6. Bucket de Storage privado

En Supabase dashboard → Storage → Buckets: el bucket `assets` debe estar como **privado** (Private), no público. Si está público, cualquiera puede acceder a los assets con el path correcto.

---

## Post-deploy

Tras el deploy exitoso en Vercel:

1. Verificar `/api/health` devuelve 200
2. Hacer login en la app y navegar a `/admin`
3. Si hay migración nueva: verificar que las queries funcionan (probar la feature afectada)
4. Monitorizar los logs de Vercel durante 5-10 minutos
