# Próximos pasos manuales

## 1. Conectar con GitHub

`gh` no está autenticado en este equipo. Ejecuta tú estos comandos (necesitan login interactivo):

```powershell
cd C:\Users\crist\Documents\PROYECTOS\Publiko

# Login (abre navegador)
gh auth login

# Crea repo privado y empuja en una sola línea
gh repo create Publiko --private --source=. --remote=origin --push --description "Agency OS — Sistema operativo de agencia de redes sociales"
```

Alternativa (si ya tienes el repo creado a mano en GitHub):

```powershell
git remote add origin https://github.com/<tu-usuario>/Publiko.git
git push -u origin main
```

## 2. Supabase

1. Crear proyecto nuevo en [supabase.com](https://supabase.com/dashboard) → región Europa.
2. Copiar `URL` y `anon key` y `service_role key` a `.env.local` (basado en `.env.example`).
3. Abrir el SQL Editor → pegar el contenido de `supabase/migrations/0001_init.sql` → Run.
4. (Opcional) Si tienes Supabase CLI conectado: `npx supabase db push`.
5. Generar tipos:
   ```powershell
   npx supabase login
   npx supabase link --project-ref <ref>
   npx supabase gen types typescript --linked > src/types/supabase.ts
   ```

## 3. Auth inicial

Crear un usuario admin desde el SQL Editor:

```sql
-- 1. Crear el usuario en auth.users desde Authentication → Users (botón "Add user")
-- 2. Luego ejecutar esto para crear su profile como admin
insert into profiles (id, role, full_name, email)
values ('<uuid-del-usuario>', 'admin', 'Cristian', 'cristiangonz.dev@gmail.com');
```

## 4. Arrancar local

```powershell
npm run dev
```

Abre http://localhost:3000.

---

Una vez completados estos pasos, seguimos con la Semana 1 del MVP:
- Formulario Brand Brain (6 pasos)
- Módulo de ideas con Claude API
- Login real conectado a Supabase Auth
