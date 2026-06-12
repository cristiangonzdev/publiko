-- =====================================================================
-- RECONCILIACIÓN BD COMPARTIDA (Publiko + Labs OS) — 2026-06-12
-- =====================================================================
-- Estado real verificado por REST el 2026-06-12 contra el proyecto
-- shmgrhddfatmvwjdkhum (compartido con Labs OS / CRMLOGIKALABS):
--
--   APLICADAS:  0001-0003, 0005-0010, 0013(parcial-verificación débil)
--               + Labs OS 0020-0024 + organizations "mínima" manual
--                 (organizations con plan/settings, profiles.organization_id,
--                  current_user_role(), get_my_org_id())
--   FALTAN:     0004 (winning_patterns — feedback loop ROTO)
--               0011 (ai_visibility_snapshots / GEO)
--               0012 (brand_brain_revisions — refinamiento de brain ROTO)
--               0014 (security hardening — RPC append_bruto_asset NO EXISTE:
--                     la subida de brutos del grabador NO registra los assets)
--               0015 (agency_settings — la UI de facturación falla)
--               0016 (campos fiscales clients/invoices)
--               0017 (bucket invoices + next_invoice_number)
--               0018 (parcial: falta organization_id en clients/invoices y
--                     constraints; organizations y profiles ya están)
--               0019 (RLS multi-org)
--
-- CÓMO APLICAR (SQL Editor del Dashboard, en este orden exacto):
--   1. Pegar y ejecutar el PASO 0 de este archivo (limpieza previa).
--   2. Pegar y ejecutar ENTERO cada fichero, en orden:
--        migrations/0004_feedback_loop.sql
--        migrations/0011_geo_addon.sql
--        migrations/0012_brain_revisions.sql
--        migrations/0014_security_hardening.sql
--        migrations/0015_agency_settings.sql
--        migrations/0016_invoicing_fiscal.sql
--        migrations/0017_invoices_storage_numbering.sql
--        migrations/0018_organizations.sql
--        migrations/0019_rls_multi_org.sql
--   3. Ejecutar el PASO FINAL (verificación) de este archivo.
--
-- Notas:
--   · 0018 es seguro sobre la organizations "mínima" de Labs OS: usa
--     create table if not exists / add column if not exists, el seed hace
--     on conflict do nothing y el backfill solo toca filas con NULL.
--   · 0019 termina con una verificación que ABORTA si quedan policies
--     antiguas sin scope de organización — por eso el PASO 0 va primero.
--   · Las tablas de Labs OS (0020-0024) no se tocan: sus policies ya
--     filtran por current_user_role()='admin' + get_my_org_id().
-- =====================================================================

-- ============================ PASO 0 =================================
-- Limpieza de policies pre-multi-org (nombres de 0001/0014). 0019 crea
-- las versiones con scope de organización; si estas siguen vivas, un
-- admin de una org vería datos de otra y la verificación de 0019 falla.

drop policy if exists "Profiles: read own or admin" on profiles;
drop policy if exists "Clients: admin full" on clients;
drop policy if exists "Invoices: admin full" on invoices;
drop policy if exists "BrandBrains: admin full" on brand_brains;
drop policy if exists "Tasks: admin full" on content_tasks;
drop policy if exists "Ideas: admin full" on content_ideas;
drop policy if exists "Posts: admin full" on posts;
drop policy if exists "Assets: admin full" on assets;
drop policy if exists "Reviews: admin full" on reviews;
drop policy if exists "Reports: admin full" on weekly_reports;
drop policy if exists "CRM: admin only" on crm_activities;
drop policy if exists "Notifications: admin full" on notifications;
-- Las siguientes solo existirán si 0004/0011/0012 se aplicaron antes en
-- otro entorno; en esta BD no existen las tablas aún — el if exists protege.
-- (agency_settings/winning_patterns/etc. se crean con policy ya correcta o
--  la corrige 0019.)

-- ========================== PASO FINAL ===============================
-- Ejecutar DESPUÉS de 0019. Todo debe devolver 0 filas / sin errores.

-- 1) Nadie sin organización:
-- select 'profiles' t, count(*) from profiles where organization_id is null
-- union all select 'clients', count(*) from clients where organization_id is null
-- union all select 'invoices', count(*) from invoices where organization_id is null;

-- 2) RPCs críticas existen:
-- select proname from pg_proc where proname in
--   ('append_bruto_asset','next_invoice_number','get_my_org_id','current_user_role');

-- 3) Ninguna policy antigua sin scope org:
-- select policyname, tablename from pg_policies where policyname in
--   ('Profiles: read own or admin','Clients: admin full','Invoices: admin full',
--    'BrandBrains: admin full','Tasks: admin full','Ideas: admin full',
--    'Posts: admin full','Assets: admin full','Reviews: admin full',
--    'Reports: admin full','CRM: admin only');

-- 4) Smoke de Labs OS tras 0019: entrar en Labs OS y comprobar que el
--    pipeline kanban sigue cargando (sus policies dependen de
--    current_user_role()/get_my_org_id(), que 0018/0019 redefinen con
--    la misma firma — no debería romper nada).
