-- ============================================
-- 0014 — Endurecimiento de seguridad + reparación de schema
-- ============================================
-- Cierra los hallazgos críticos/altos de la auditoría 2026-06-09:
--  1. profiles UPDATE sin WITH CHECK → escalada a admin
--  2. RPCs SECURITY DEFINER sin autorización ni search_path
--  3. get_posts_to_publish (0009) inválida + sin backoff → publish roto
--  4. claim atómico de posts para evitar doble publicación
--  5. policy notifications INSERT abierta + schema en conflicto
--  6. UNIQUE faltantes (weekly_reports, content_tasks.idea_id)
--  7. índices faltantes para RLS/joins calientes
--  8. bucket assets público → privado
--  9. FK de assets sin ON DELETE → bloquean cleanup

-- ============================================
-- 1. current_user_role — debe existir ANTES de las policies que la usan.
--    search_path hardening (la usan las policies RLS, por eso NO se revoca
--    de authenticated).
-- ============================================
create or replace function current_user_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid()
$$;

-- ============================================
-- 2. PROFILES — impedir auto-escalada de rol
-- ============================================
drop policy if exists "Profiles: update own" on profiles;
create policy "Profiles: update own" on profiles
  for update
  using (id = auth.uid() or current_user_role() = 'admin')
  with check (
    -- un no-admin solo puede actualizar su propia fila SIN cambiar su rol
    (id = auth.uid() and role = (select p.role from profiles p where p.id = auth.uid()))
    or current_user_role() = 'admin'
  );

-- ============================================
-- 2b. RPCs admin/cron — guard interno + search_path
-- ============================================
-- get_mrr_total: solo admin (dashboard) o service_role (crons)
create or replace function get_mrr_total()
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (auth.role() = 'service_role' or current_user_role() = 'admin') then
    raise exception 'no autorizado';
  end if;
  return (
    select coalesce(sum(monthly_fee), 0)::integer
    from clients
    where status = 'active' and is_active = true
  );
end;
$$;

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
    and coalesce(c.billing_day, 1) between
      extract(day from now())::integer
      and extract(day from now())::integer + days_ahead;
end;
$$;

-- compute_client_baseline: solo service_role/admin
create or replace function compute_client_baseline(p_client_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cutoff timestamptz := now() - interval '60 days';
begin
  if not (auth.role() = 'service_role' or current_user_role() = 'admin') then
    raise exception 'no autorizado';
  end if;

  delete from client_performance_baselines where client_id = p_client_id;

  insert into client_performance_baselines (
    client_id, platform, content_type,
    median_engagement_rate, p75_engagement_rate, p90_engagement_rate,
    median_reach, sample_size, computed_at
  )
  select
    p.client_id,
    p.platform,
    coalesce(ct.content_type, 'post'::content_type),
    percentile_cont(0.5) within group (order by p.engagement_rate),
    percentile_cont(0.75) within group (order by p.engagement_rate),
    percentile_cont(0.9)  within group (order by p.engagement_rate),
    percentile_cont(0.5) within group (order by p.reach)::int,
    count(*)::int,
    now()
  from posts p
  left join content_tasks ct on ct.id = p.task_id
  where p.client_id = p_client_id
    and p.status = 'published'
    and p.published_at >= cutoff
    and p.engagement_rate is not null
  group by p.client_id, p.platform, ct.content_type
  having count(*) >= 3;
end;
$$;

-- get_winning_patterns_for_prompt: solo service_role/admin
create or replace function get_winning_patterns_for_prompt(
  p_client_id uuid,
  p_limit integer default 10
)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not (auth.role() = 'service_role' or current_user_role() = 'admin') then
    raise exception 'no autorizado';
  end if;

  return (
    select coalesce(jsonb_agg(pat order by score desc), '[]'::jsonb)
    from (
      select
        jsonb_build_object(
          'source', wp.source,
          'features', wp.features,
          'reason', wp.manual_reason,
          'impact_multiplier', wp.impact_multiplier,
          'metrics', wp.metrics_snapshot,
          'days_ago', extract(day from now() - wp.created_at)::int
        ) as pat,
        (
          exp(- extract(epoch from (now() - wp.created_at)) / (30.0 * 86400.0))
          * coalesce(wp.impact_multiplier, 1.5)
        ) as score
      from winning_patterns wp
      where wp.client_id = p_client_id
        and wp.active = true
      order by score desc
      limit p_limit
    ) ranked
  );
end;
$$;

-- ============================================
-- 3. get_posts_to_publish — reparada (0009 era inválida)
--    DROP explícito (cambia tipo de retorno), content_type desde el join,
--    rama de backoff restaurada. Solo service_role.
-- ============================================
drop function if exists get_posts_to_publish();
create or replace function get_posts_to_publish()
returns table(
  post_id uuid, client_id uuid, platform platform,
  content_type text, copy text, hashtags text[], asset_id uuid,
  external_post_id text,
  meta_system_user_token text, meta_business_id text, facebook_page_id text,
  attempts_made integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'no autorizado';
  end if;
  return query
  select
    p.id, p.client_id, p.platform,
    coalesce(ct.content_type::text, 'post'),
    p.copy, p.hashtags, p.asset_id,
    p.external_post_id,
    c.meta_system_user_token, c.meta_business_id, c.facebook_page_id,
    coalesce(p.retry_count, 0)
  from posts p
  join clients c on c.id = p.client_id
  left join content_tasks ct on ct.id = p.task_id
  where p.status = 'scheduled'
    and c.is_active = true
    and (
      (p.scheduled_at <= now() and p.scheduled_retry_at is null)
      or (p.scheduled_retry_at is not null and p.scheduled_retry_at <= now() and p.retry_count < 3)
    );
end;
$$;

-- ============================================
-- 4. claim_posts_to_publish — selección atómica anti-doble-publicación
--    Marca status='publishing' con FOR UPDATE SKIP LOCKED y devuelve el lote.
-- ============================================
create or replace function claim_posts_to_publish(batch_size integer default 25)
returns table(
  post_id uuid, client_id uuid, platform platform,
  content_type text, copy text, hashtags text[], asset_id uuid,
  external_post_id text,
  meta_system_user_token text, meta_business_id text, facebook_page_id text,
  attempts_made integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'no autorizado';
  end if;
  return query
  with due as (
    select p.id
    from posts p
    join clients c on c.id = p.client_id
    where p.status = 'scheduled'
      and c.is_active = true
      and (
        (p.scheduled_at <= now() and p.scheduled_retry_at is null)
        or (p.scheduled_retry_at is not null and p.scheduled_retry_at <= now() and p.retry_count < 3)
      )
    order by p.scheduled_at nulls last
    limit batch_size
    for update of p skip locked
  ),
  claimed as (
    update posts p
      set status = 'publishing', last_attempt_at = now()
    from due
    where p.id = due.id
    returning p.id, p.client_id, p.platform, p.task_id, p.copy, p.hashtags,
              p.asset_id, p.external_post_id, p.retry_count
  )
  select
    cl.id, cl.client_id, cl.platform,
    coalesce(ct.content_type::text, 'post'),
    cl.copy, cl.hashtags, cl.asset_id, cl.external_post_id,
    c.meta_system_user_token, c.meta_business_id, c.facebook_page_id,
    coalesce(cl.retry_count, 0)
  from claimed cl
  join clients c on c.id = cl.client_id
  left join content_tasks ct on ct.id = cl.task_id;
end;
$$;

revoke execute on function claim_posts_to_publish(integer) from public, anon, authenticated;
grant execute on function claim_posts_to_publish(integer) to service_role;

-- ============================================
-- 5. NOTIFICATIONS — reconciliar schema + cerrar policy de inserción
-- ============================================
alter table notifications add column if not exists task_id uuid references content_tasks(id) on delete set null;
alter table notifications add column if not exists client_name text;
alter table notifications alter column channel drop not null;
alter table notifications alter column channel set default 'in_app';
alter table notifications alter column type drop not null;

-- la policy WITH CHECK (true) permitía a cualquier usuario forjar notificaciones;
-- el service role ya bypasa RLS, así que no se necesita.
drop policy if exists "notifications_service_insert" on notifications;

-- ============================================
-- 6. UNIQUE faltantes
-- ============================================
-- una idea genera como máximo una tarea (evita duplicados por doble-click/cron)
create unique index if not exists uq_content_tasks_idea
  on content_tasks(idea_id) where idea_id is not null;

-- un único informe por cliente y semana (lo que el upsert espera)
do $$ begin
  alter table weekly_reports
    add constraint uq_weekly_reports_client_week unique (client_id, week_start);
exception when duplicate_object then null; end $$;

-- ============================================
-- 7. content_ideas — hora sugerida con columna dedicada (no reusar human_input)
-- ============================================
alter table content_ideas add column if not exists suggested_publish_time text;

-- ============================================
-- 8. ÍNDICES faltantes (RLS filters + joins calientes)
-- ============================================
create index if not exists idx_content_tasks_grabador on content_tasks(grabador_id) where grabador_id is not null;
create index if not exists idx_content_tasks_editor on content_tasks(editor_id) where editor_id is not null;
create index if not exists idx_content_tasks_idea on content_tasks(idea_id) where idea_id is not null;
create index if not exists idx_posts_task on posts(task_id);
create index if not exists idx_clients_client_user on clients(client_user_id) where client_user_id is not null;
create index if not exists idx_clients_assigned_editor on clients(assigned_editor_id) where assigned_editor_id is not null;
create index if not exists idx_clients_assigned_grabador on clients(assigned_grabador_id) where assigned_grabador_id is not null;
create index if not exists idx_weekly_reports_client on weekly_reports(client_id);
create index if not exists idx_invoices_client on invoices(client_id);
create index if not exists idx_crm_activities_client on crm_activities(client_id);
create index if not exists idx_notifications_user_created on notifications(user_id, created_at desc);

-- ============================================
-- 9. STORAGE — bucket privado (servir vía signed URLs)
-- ============================================
update storage.buckets set public = false where id = 'assets';
drop policy if exists "assets_public_read" on storage.objects;

-- ============================================
-- 10. FK de assets con ON DELETE SET NULL (desbloquea cleanup-assets)
-- ============================================
do $$ begin
  alter table posts drop constraint if exists posts_asset_id_fkey;
  alter table posts add constraint posts_asset_id_fkey
    foreign key (asset_id) references assets(id) on delete set null;
exception when others then null; end $$;

do $$ begin
  alter table content_tasks drop constraint if exists content_tasks_final_asset_id_fkey;
  alter table content_tasks add constraint content_tasks_final_asset_id_fkey
    foreign key (final_asset_id) references assets(id) on delete set null;
exception when others then null; end $$;

-- ============================================
-- 11. append_bruto_asset — append atómico (evita la race read-modify-write
--     al subir varios brutos en paralelo, que perdía ids)
-- ============================================
create or replace function append_bruto_asset(p_task_id uuid, p_asset_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'no autorizado';
  end if;
  update content_tasks
    set bruto_asset_ids = array_append(coalesce(bruto_asset_ids, '{}'), p_asset_id),
        brutos_uploaded_at = now(),
        updated_at = now()
  where id = p_task_id;
end;
$$;

revoke execute on function append_bruto_asset(uuid, uuid) from public, anon, authenticated;
grant execute on function append_bruto_asset(uuid, uuid) to service_role;
