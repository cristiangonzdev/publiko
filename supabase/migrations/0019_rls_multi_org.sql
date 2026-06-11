-- ============================================
-- 0019: RLS MULTI-ORG
-- Añade la capa de organización a las policies de admin. Las policies
-- por rol (editor/grabador/cliente) NO se tocan: ya son single-user
-- (auth.uid() directo o asignación vía clients) y la app garantiza que
-- las asignaciones no cruzan orgs.
-- Para la única org existente las policies nuevas son un subconjunto
-- estricto de las viejas: nadie pierde acceso legítimo.
-- ============================================

-- ============================================
-- 1. ORGANIZATIONS (tabla nueva, 0018 la dejó deny-all)
-- ============================================
drop policy if exists "Org: members read own" on organizations;
create policy "Org: members read own" on organizations
  for select using (id = get_my_org_id());

drop policy if exists "Org: admin updates own" on organizations;
create policy "Org: admin updates own" on organizations
  for update
  using (current_user_role() = 'admin' and id = get_my_org_id())
  with check (current_user_role() = 'admin' and id = get_my_org_id());
-- INSERT/DELETE: sin policy para authenticated (solo service role).

-- ============================================
-- 2. PROFILES — admin limitado a su org; nadie se auto-mueve de org
-- ============================================
drop policy if exists "Profiles: read own or admin" on profiles;
create policy "Profiles: read own or org admin" on profiles
  for select using (
    id = auth.uid()
    or (current_user_role() = 'admin' and organization_id = get_my_org_id())
  );

drop policy if exists "Profiles: update own" on profiles;
create policy "Profiles: update own" on profiles
  for update
  using (
    id = auth.uid()
    or (current_user_role() = 'admin' and organization_id = get_my_org_id())
  )
  with check (
    -- un no-admin solo actualiza su propia fila SIN cambiar rol ni org
    (
      id = auth.uid()
      and role = (select p.role from profiles p where p.id = auth.uid())
      and organization_id = (select p.organization_id from profiles p where p.id = auth.uid())
    )
    or (current_user_role() = 'admin' and organization_id = get_my_org_id())
  );

-- ============================================
-- 3. TABLAS CON organization_id DIRECTO
-- ============================================
drop policy if exists "Clients: admin full" on clients;
create policy "Clients: org admin full" on clients
  for all
  using (current_user_role() = 'admin' and organization_id = get_my_org_id())
  with check (current_user_role() = 'admin' and organization_id = get_my_org_id());

drop policy if exists "Invoices: admin full" on invoices;
create policy "Invoices: org admin full" on invoices
  for all
  using (current_user_role() = 'admin' and organization_id = get_my_org_id())
  with check (current_user_role() = 'admin' and organization_id = get_my_org_id());

drop policy if exists "AgencySettings: admin full" on agency_settings;
create policy "AgencySettings: org admin full" on agency_settings
  for all
  using (current_user_role() = 'admin' and organization_id = get_my_org_id())
  with check (current_user_role() = 'admin' and organization_id = get_my_org_id());

-- ============================================
-- 4. TABLAS HIJAS (client_id) — org vía join a clients.
-- El EXISTS evalúa la RLS de clients para el usuario actual, que para
-- un admin ya está limitada a su org (sección 3): coherente y sin
-- recursión (las policies de clients no referencian tablas hijas).
-- ============================================

drop policy if exists "BrandBrains: admin full" on brand_brains;
create policy "BrandBrains: org admin full" on brand_brains
  for all
  using (
    current_user_role() = 'admin'
    and exists (select 1 from clients c where c.id = brand_brains.client_id and c.organization_id = get_my_org_id())
  )
  with check (
    current_user_role() = 'admin'
    and exists (select 1 from clients c where c.id = brand_brains.client_id and c.organization_id = get_my_org_id())
  );

drop policy if exists "Tasks: admin full" on content_tasks;
create policy "Tasks: org admin full" on content_tasks
  for all
  using (
    current_user_role() = 'admin'
    and exists (select 1 from clients c where c.id = content_tasks.client_id and c.organization_id = get_my_org_id())
  )
  with check (
    current_user_role() = 'admin'
    and exists (select 1 from clients c where c.id = content_tasks.client_id and c.organization_id = get_my_org_id())
  );

drop policy if exists "Ideas: admin full" on content_ideas;
create policy "Ideas: org admin full" on content_ideas
  for all
  using (
    current_user_role() = 'admin'
    and exists (select 1 from clients c where c.id = content_ideas.client_id and c.organization_id = get_my_org_id())
  )
  with check (
    current_user_role() = 'admin'
    and exists (select 1 from clients c where c.id = content_ideas.client_id and c.organization_id = get_my_org_id())
  );

drop policy if exists "Posts: admin full" on posts;
create policy "Posts: org admin full" on posts
  for all
  using (
    current_user_role() = 'admin'
    and exists (select 1 from clients c where c.id = posts.client_id and c.organization_id = get_my_org_id())
  )
  with check (
    current_user_role() = 'admin'
    and exists (select 1 from clients c where c.id = posts.client_id and c.organization_id = get_my_org_id())
  );

drop policy if exists "Assets: admin full" on assets;
create policy "Assets: org admin full" on assets
  for all
  using (
    current_user_role() = 'admin'
    and exists (select 1 from clients c where c.id = assets.client_id and c.organization_id = get_my_org_id())
  )
  with check (
    current_user_role() = 'admin'
    and exists (select 1 from clients c where c.id = assets.client_id and c.organization_id = get_my_org_id())
  );

drop policy if exists "Reviews: admin full" on reviews;
create policy "Reviews: org admin full" on reviews
  for all
  using (
    current_user_role() = 'admin'
    and exists (select 1 from clients c where c.id = reviews.client_id and c.organization_id = get_my_org_id())
  )
  with check (
    current_user_role() = 'admin'
    and exists (select 1 from clients c where c.id = reviews.client_id and c.organization_id = get_my_org_id())
  );

drop policy if exists "Reports: admin full" on weekly_reports;
create policy "Reports: org admin full" on weekly_reports
  for all
  using (
    current_user_role() = 'admin'
    and exists (select 1 from clients c where c.id = weekly_reports.client_id and c.organization_id = get_my_org_id())
  )
  with check (
    current_user_role() = 'admin'
    and exists (select 1 from clients c where c.id = weekly_reports.client_id and c.organization_id = get_my_org_id())
  );

drop policy if exists "CRM: admin only" on crm_activities;
create policy "CRM: org admin only" on crm_activities
  for all
  using (
    current_user_role() = 'admin'
    and exists (select 1 from clients c where c.id = crm_activities.client_id and c.organization_id = get_my_org_id())
  )
  with check (
    current_user_role() = 'admin'
    and exists (select 1 from clients c where c.id = crm_activities.client_id and c.organization_id = get_my_org_id())
  );

drop policy if exists "Baselines: admin full" on client_performance_baselines;
create policy "Baselines: org admin full" on client_performance_baselines
  for all
  using (
    current_user_role() = 'admin'
    and exists (select 1 from clients c where c.id = client_performance_baselines.client_id and c.organization_id = get_my_org_id())
  )
  with check (
    current_user_role() = 'admin'
    and exists (select 1 from clients c where c.id = client_performance_baselines.client_id and c.organization_id = get_my_org_id())
  );

drop policy if exists "Winning patterns: admin full" on winning_patterns;
create policy "Winning patterns: org admin full" on winning_patterns
  for all
  using (
    current_user_role() = 'admin'
    and exists (select 1 from clients c where c.id = winning_patterns.client_id and c.organization_id = get_my_org_id())
  )
  with check (
    current_user_role() = 'admin'
    and exists (select 1 from clients c where c.id = winning_patterns.client_id and c.organization_id = get_my_org_id())
  );

drop policy if exists "admin full access on ai_visibility_snapshots" on ai_visibility_snapshots;
create policy "Geo: org admin full" on ai_visibility_snapshots
  for all
  using (
    current_user_role() = 'admin'
    and exists (select 1 from clients c where c.id = ai_visibility_snapshots.client_id and c.organization_id = get_my_org_id())
  )
  with check (
    current_user_role() = 'admin'
    and exists (select 1 from clients c where c.id = ai_visibility_snapshots.client_id and c.organization_id = get_my_org_id())
  );

drop policy if exists "admin full access on brand_brain_revisions" on brand_brain_revisions;
create policy "BrainRevisions: org admin full" on brand_brain_revisions
  for all
  using (
    current_user_role() = 'admin'
    and exists (select 1 from clients c where c.id = brand_brain_revisions.client_id and c.organization_id = get_my_org_id())
  )
  with check (
    current_user_role() = 'admin'
    and exists (select 1 from clients c where c.id = brand_brain_revisions.client_id and c.organization_id = get_my_org_id())
  );

-- ============================================
-- 5. NOTIFICATIONS — la campana es por usuario; se elimina el OR admin
-- global (dejaba al admin de la org A leer notificaciones de la B).
-- "notifications_own" (0008, FOR ALL user_id = auth.uid()) ya es segura.
-- ============================================
drop policy if exists "Notifications: own only" on notifications;
create policy "Notifications: own only" on notifications
  for select using (user_id = auth.uid());

-- ============================================
-- 6. RPCs v2 org-aware (misma firma → código existente intacto)
-- ============================================

-- get_mrr_total: service_role → global (crons); admin → su org.
create or replace function get_mrr_total()
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' then
    return (
      select coalesce(sum(monthly_fee), 0)::integer
      from clients
      where status = 'active' and is_active = true
    );
  end if;
  if current_user_role() <> 'admin' then
    raise exception 'no autorizado';
  end if;
  return (
    select coalesce(sum(monthly_fee), 0)::integer
    from clients
    where status = 'active' and is_active = true
      and organization_id = get_my_org_id()
  );
end;
$$;

-- get_upcoming_renewals: ídem (filtro org solo para admin).
create or replace function get_upcoming_renewals(days_ahead integer default 30)
returns table(client_id uuid, business_name text, monthly_fee integer, renewal_date date)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (auth.role() = 'service_role' or current_user_role() = 'admin') then
    raise exception 'no autorizado';
  end if;
  return query
  select c.id, c.business_name, c.monthly_fee,
    (date_trunc('month', now()) + ((coalesce(c.billing_day, 1) - 1) || ' days')::interval)::date
  from clients c
  where c.status = 'active'
    and (auth.role() = 'service_role' or c.organization_id = get_my_org_id())
    and coalesce(c.billing_day, 1) between
      extract(day from now())::integer
      and extract(day from now())::integer + days_ahead;
end;
$$;

-- next_invoice_number: contador por org. La llamada sin argumentos del
-- código wave-A sigue funcionando (admin deriva su org).
drop function if exists next_invoice_number();
create or replace function next_invoice_number(p_org uuid default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_prefix text;
  v_n integer;
begin
  if auth.role() = 'service_role' then
    v_org := p_org;
    if v_org is null then
      raise exception 'p_org es obligatorio para service_role';
    end if;
  elsif current_user_role() = 'admin' then
    v_org := get_my_org_id();
  else
    raise exception 'no autorizado';
  end if;

  update agency_settings
     set next_invoice_number = next_invoice_number + 1,
         updated_at = now()
   where organization_id = v_org
   returning invoice_prefix, next_invoice_number - 1
        into v_prefix, v_n;

  if not found then
    raise exception 'agency_settings_missing';
  end if;

  return v_prefix || '-' || to_char(now(), 'YYYY') || '-' || lpad(v_n::text, 4, '0');
end;
$$;

-- ============================================
-- 7. VERIFICACIÓN — falla la transacción si quedó alguna policy admin
-- sin scope de org.
-- ============================================
do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and policyname in (
        'Profiles: read own or admin',
        'Clients: admin full',
        'BrandBrains: admin full',
        'Tasks: admin full',
        'Ideas: admin full',
        'Posts: admin full',
        'Assets: admin full',
        'Reviews: admin full',
        'Reports: admin full',
        'CRM: admin only',
        'Invoices: admin full',
        'AgencySettings: admin full',
        'Baselines: admin full',
        'Winning patterns: admin full',
        'admin full access on ai_visibility_snapshots',
        'admin full access on brand_brain_revisions'
      )
  ) then
    raise exception 'RLS multi-org incompleta: quedan policies admin sin scope de organización';
  end if;
end $$;
