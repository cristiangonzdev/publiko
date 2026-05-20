# Próximos pasos — Deploy

Estado actual: scaffolding completo + flujo aprobar→producción→bruto→editor + b-rolls + uploads por signed URL. Build verde, typecheck verde, git inicializado y primer commit hecho.

Lo que queda para tener la app viva en internet son 4 pasos manuales (necesitan tus credenciales, yo no puedo hacerlos en tu nombre).

---

## 1. Supabase — proyecto + schema + bucket

1. Crear proyecto en [supabase.com](https://supabase.com/dashboard) → región Europa.
2. SQL Editor → pegar `supabase/migrations/0001_init.sql` → Run.
3. SQL Editor → pegar `supabase/migrations/0002_storage_setup.sql` → Run (crea el bucket `assets` público con límite de 5 GB por archivo).
4. Authentication → Users → Add user → crea tu usuario admin.
5. SQL Editor:
   ```sql
   insert into profiles (id, role, full_name, email)
   values ('<uuid-del-usuario>', 'admin', 'Cristian', 'cristiangonz.dev@gmail.com');
   ```

## 2. Variables de entorno (`.env.local`)

Copia `.env.example` a `.env.local` y rellena al menos lo crítico para empezar:

```bash
NEXT_PUBLIC_SUPABASE_URL=          # Settings → API
NEXT_PUBLIC_SUPABASE_ANON_KEY=     # Settings → API
SUPABASE_SERVICE_ROLE_KEY=         # Settings → API (NO subir a git)
ANTHROPIC_API_KEY=                 # console.anthropic.com
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

El resto (Meta, Drive, Telegram, Resend, n8n) puedes dejarlos vacíos por ahora — el sistema arranca, solo se romperán los flujos que dependan de esas APIs.

## 3. Probar en local

```powershell
npm run dev
```

Login en http://localhost:3000/login con el admin que creaste. Ve a `/admin/clients/new`, crea un cliente, rellena Brand Brain, genera ideas, aprueba una → elige copy → envía a producción → sube tu bruto.

## 4. Deploy a Vercel

```powershell
npm i -g vercel
vercel login
vercel                              # primera vez: crea proyecto y enlaza
# Vercel te preguntará el nombre del proyecto y settings — acepta los defaults
```

Después, añadir las env vars en Vercel:

```powershell
# Opción A: por CLI, una por una
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add ANTHROPIC_API_KEY
vercel env add NEXT_PUBLIC_APP_URL   # poner aquí la URL final de Vercel

# Opción B: en el dashboard de Vercel → Settings → Environment Variables (más cómodo)
```

Finalmente:

```powershell
vercel --prod
```

Listo. Te devuelve una URL `https://publiko-xxxx.vercel.app`. Esa es la app en producción.

---

## Conectar con GitHub (opcional)

Si quieres que cada `git push` despliegue automáticamente:

```powershell
gh auth login                       # solo la primera vez
gh repo create Publiko --private --source=. --remote=origin --push
# luego en Vercel: Settings → Git → Connect to GitHub repo
```

---

## Notas

- **Calidad de vídeo:** todos los uploads (brutos, entregables, b-rolls) van directos a Supabase Storage vía signed URL — no pasan por Vercel, así que no hay límite de 4.5 MB y no se recomprime nada. El editor descarga el mismo binario que se subió.
- **Tope por archivo:** 5 GB por archivo (configurado en la migración 0002). Si te quedas corto, súbelo en Supabase → Storage → Settings.
- **Plan Supabase:** el free aguanta poco volumen real. Para 4 restaurantes × 17 piezas/día deberías estar en plan Pro desde el principio (storage + bandwidth).
