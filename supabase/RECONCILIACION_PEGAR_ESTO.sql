-- ===================================================================
-- PUBLIKO — RECONCILIACION COMPLETA BD COMPARTIDA — 2026-06-12
-- Pegar ENTERO en el SQL Editor y ejecutar UNA SOLA VEZ.
-- Atomico: si algo falla, se revierte todo y la BD queda como estaba.
-- Incluye 0005/0007/0009/0013 por seguridad (idempotentes: si ya
-- estaban aplicadas no cambian nada).
-- ===================================================================

-- PASO 0: limpiar policies pre-multi-org (0019 las sustituye con scope de org)
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

-- ===================== 0004_feedback_loop.sql =====================
-- ============================================
-- 0004 — Feedback loop: posts ganadores retroalimentan generación
-- ============================================
-- Additive only. Mantiene compatibilidad con código actual.
--
-- Capa A (auto):    harvest detecta posts que superan baseline → marca is_winner
-- Capa B (manual):  admin marca post con "esto funcionó porque ..."
-- Capa C (prompt):  generateWeeklyIdeas / generateDailyBatch / generateCopyOptions
--                   leen winning_patterns activos y los inyectan al system prompt.

-- ============================================
-- POSTS — flag de ganador + snapshot del baseline al publicar
-- ============================================
alter table posts
  add column if not exists is_winner boolean not null default false,
  add column if not exists winner_source text,
  add column if not exists winner_score numeric(6,3),
  add column if not exists winner_marked_at timestamptz,
  add column if not exists baseline_engagement_at_publish numeric(5,4);

do $$ begin
  alter table posts
    add constraint posts_winner_source_check
    check (winner_source is null or winner_source in ('auto', 'manual', 'hybrid'));
exception when duplicate_object or duplicate_table then null; end $$;

create index if not exists idx_posts_winners on posts(client_id, is_winner) where is_winner = true;

-- ============================================
-- CLIENT_PERFORMANCE_BASELINES — mediana móvil de engagement por cliente/plataforma/formato
-- ============================================
create table if not exists client_performance_baselines (
  client_id uuid not null references clients(id) on delete cascade,
  platform platform not null,
  content_type content_type not null,

  median_engagement_rate numeric(5,4),
  p75_engagement_rate numeric(5,4),
  p90_engagement_rate numeric(5,4),
  median_reach integer,
  sample_size integer not null default 0,

  computed_at timestamptz not null default now(),

  primary key (client_id, platform, content_type)
);

create index if not exists idx_baselines_client on client_performance_baselines(client_id);

-- ============================================
-- WINNING_PATTERNS — qué ha funcionado para cada cliente
-- ============================================
create table if not exists winning_patterns (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  post_id uuid references posts(id) on delete set null,

  source text not null,
  -- features extraídas (auto) o anotadas (manual)
  -- shape recomendado:
  -- {
  --   "content_type": "reel",
  --   "angle": "humor",
  --   "platform": "instagram",
  --   "hook": "primeras palabras del copy",
  --   "concept_summary": "1 línea",
  --   "publish_hour": "20",
  --   "weekday": "saturday",
  --   "length_seconds": 18,
  --   "has_cta": true,
  --   "copy_excerpt": "fragmento corto"
  -- }
  features jsonb not null default '{}'::jsonb,

  -- explicación libre del admin: por qué crees que funcionó
  manual_reason text,

  -- métricas reales en el momento de marcar
  metrics_snapshot jsonb not null default '{}'::jsonb,

  -- cuánto sobre baseline (1.0 = igual, 2.5 = 2.5x); manual sin auto → null
  impact_multiplier numeric(6,3),

  -- si admin lo descarta (ya no aplica, fue casualidad, etc.)
  active boolean not null default true,
  archived_reason text,

  marked_by uuid references profiles(id),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  alter table winning_patterns
    add constraint winning_patterns_source_check
    check (source in ('auto', 'manual', 'hybrid'));
exception when duplicate_object or duplicate_table then null; end $$;

create index if not exists idx_winning_patterns_client_active
  on winning_patterns(client_id, active) where active = true;
create index if not exists idx_winning_patterns_recency
  on winning_patterns(client_id, created_at desc) where active = true;

-- ============================================
-- RLS
-- ============================================
alter table client_performance_baselines enable row level security;
alter table winning_patterns enable row level security;

drop policy if exists "Baselines: admin full" on client_performance_baselines;
create policy "Baselines: admin full" on client_performance_baselines
  for all using (current_user_role() = 'admin')
  with check (current_user_role() = 'admin');

drop policy if exists "Baselines: client reads own" on client_performance_baselines;
create policy "Baselines: client reads own" on client_performance_baselines
  for select using (
    exists (
      select 1 from clients c
      where c.id = client_performance_baselines.client_id
        and c.client_user_id = auth.uid()
    )
  );

drop policy if exists "Winning patterns: admin full" on winning_patterns;
create policy "Winning patterns: admin full" on winning_patterns
  for all using (current_user_role() = 'admin')
  with check (current_user_role() = 'admin');

drop policy if exists "Winning patterns: client reads own" on winning_patterns;
create policy "Winning patterns: client reads own" on winning_patterns
  for select using (
    exists (
      select 1 from clients c
      where c.id = winning_patterns.client_id
        and c.client_user_id = auth.uid()
    )
  );

-- ============================================
-- TRIGGERS
-- ============================================
do $$ begin
  create trigger update_winning_patterns_updated_at before update on winning_patterns
    for each row execute function update_updated_at();
exception when duplicate_object or duplicate_table then null; end $$;

-- ============================================
-- compute_client_baseline(client_id)
-- Recalcula baseline rolling 60 días por cliente/plataforma/content_type.
-- Llamada desde el cron de harvest después de actualizar métricas.
-- ============================================
create or replace function compute_client_baseline(p_client_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  cutoff timestamptz := now() - interval '60 days';
begin
  delete from client_performance_baselines where client_id = p_client_id;

  insert into client_performance_baselines (
    client_id, platform, content_type,
    median_engagement_rate, p75_engagement_rate, p90_engagement_rate,
    median_reach, sample_size, computed_at
  )
  select
    p.client_id,
    p.platform,
    coalesce(ct.content_type, 'post'::content_type) as content_type,
    percentile_cont(0.5) within group (order by p.engagement_rate) as median_eng,
    percentile_cont(0.75) within group (order by p.engagement_rate) as p75_eng,
    percentile_cont(0.9)  within group (order by p.engagement_rate) as p90_eng,
    percentile_cont(0.5) within group (order by p.reach)::int as median_reach,
    count(*)::int as sample_size,
    now()
  from posts p
  left join content_tasks ct on ct.id = p.task_id
  where p.client_id = p_client_id
    and p.status = 'published'
    and p.published_at >= cutoff
    and p.engagement_rate is not null
  group by p.client_id, p.platform, ct.content_type
  having count(*) >= 3;  -- baseline solo si hay ≥3 muestras
end;
$$;

-- ============================================
-- get_winning_patterns_for_prompt(client_id, n)
-- Devuelve los patrones activos más recientes con mayor impacto,
-- ya formateados como JSON para inyectar al system prompt.
-- ============================================
create or replace function get_winning_patterns_for_prompt(
  p_client_id uuid,
  p_limit integer default 10
)
returns jsonb
language sql
security definer
stable
as $$
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
      -- recencia (decae 30 días) * impacto. Manual sin impact = peso 1.5 fijo.
      (
        exp(- extract(epoch from (now() - wp.created_at)) / (30.0 * 86400.0))
        *
        coalesce(wp.impact_multiplier, 1.5)
      ) as score
    from winning_patterns wp
    where wp.client_id = p_client_id
      and wp.active = true
    order by score desc
    limit p_limit
  ) ranked;
$$;


-- ===================== 0005_publish_stories.sql =====================
-- ============================================
-- 0005 — Soporte de stories en el pipeline de publicación
-- ============================================
-- get_posts_to_publish ahora devuelve content_type del task asociado,
-- para que el endpoint de publish pueda decidir kind=story vs kind=feed.
-- Drop necesario: Postgres no permite cambiar return type con CREATE OR REPLACE.

drop function if exists get_posts_to_publish();

create or replace function get_posts_to_publish()
returns table(
  post_id uuid,
  client_id uuid,
  platform platform,
  content_type content_type,
  copy text,
  hashtags text[],
  asset_id uuid,
  meta_system_user_token text,
  meta_business_id text
)
language sql
security definer
as $$
  select
    p.id,
    p.client_id,
    p.platform,
    coalesce(ct.content_type, 'post'::content_type) as content_type,
    p.copy,
    p.hashtags,
    p.asset_id,
    c.meta_system_user_token,
    c.meta_business_id
  from posts p
  join clients c on c.id = p.client_id
  left join content_tasks ct on ct.id = p.task_id
  where p.status = 'scheduled'
    and p.scheduled_at <= now()
    and c.is_active = true;
$$;


-- ===================== 0007_gmb_integration.sql =====================
-- ============================================
-- 0007 — Google Business Profile integration
-- ============================================
-- Cada cliente puede tener su location de GMB vinculada. Si está rellena,
-- se permite publicar posts gmb y harvest de reseñas Google.

alter table clients
  add column if not exists gmb_account_id text,
  add column if not exists gmb_location_id text;

create index if not exists idx_clients_gmb
  on clients(gmb_location_id) where gmb_location_id is not null;

-- reviews: añadir campos para borrador IA + tracking del review externo
alter table reviews
  add column if not exists external_review_id text,
  add column if not exists ai_draft text,
  add column if not exists ai_draft_at timestamptz;

create unique index if not exists idx_reviews_external_unique
  on reviews(client_id, external_review_id)
  where external_review_id is not null;


-- ===================== 0009_facebook_page_id.sql =====================
-- Separar IG Business Account ID de Facebook Page ID
-- meta_business_id ya existía y se usaba para ambos — ahora tiene su propio campo FB
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS facebook_page_id text;

-- Actualizar la RPC get_posts_to_publish para devolver facebook_page_id
-- [OMITIDO] La RPC get_posts_to_publish de 0009 era invalida (referenciaba
-- posts.content_type, columna inexistente) — 0014 la reescribe correctamente
-- mas abajo en este mismo lote.


-- ===================== 0011_geo_addon.sql =====================
-- GEO Add-on: AI visibility tracking per client

ALTER TABLE clients ADD COLUMN IF NOT EXISTS geo_tracking_enabled boolean DEFAULT false;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS geo_location text;  -- e.g. "Las Palmas de Gran Canaria"

CREATE TABLE IF NOT EXISTS ai_visibility_snapshots (
  id                  uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  client_id           uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  query               text NOT NULL,
  ai_response_excerpt text,
  brand_mentioned     boolean DEFAULT false,
  brand_position      integer,   -- 1 = first mention, null if not mentioned
  brand_sentiment     text CHECK (brand_sentiment IN ('positive', 'neutral', 'negative')),
  snapshot_date       date NOT NULL DEFAULT CURRENT_DATE,
  created_at          timestamptz DEFAULT now()
);

ALTER TABLE ai_visibility_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin full access on ai_visibility_snapshots"
  ON ai_visibility_snapshots FOR ALL TO authenticated
  USING (current_user_role() = 'admin');

CREATE INDEX IF NOT EXISTS idx_ai_visibility_client_date
  ON ai_visibility_snapshots (client_id, snapshot_date DESC);


-- ===================== 0012_brain_revisions.sql =====================
-- Brand Brain auto-refinement: proposed changes queue

CREATE TABLE IF NOT EXISTS brand_brain_revisions (
  id               uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  client_id        uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  section          text NOT NULL,           -- e.g. 'voice', 'audience', 'content_pillars'
  proposed_changes jsonb NOT NULL,          -- proposed new value for that section
  reasoning        text NOT NULL,           -- why Claude proposes this (performance evidence)
  status           text DEFAULT 'pending'
                   CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by      uuid REFERENCES profiles(id),
  reviewed_at      timestamptz,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

ALTER TABLE brand_brain_revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin full access on brand_brain_revisions"
  ON brand_brain_revisions FOR ALL TO authenticated
  USING (current_user_role() = 'admin');

CREATE INDEX IF NOT EXISTS idx_brain_revisions_client_status
  ON brand_brain_revisions (client_id, status, created_at DESC);


-- ===================== 0013_report_churn.sql =====================
-- Weekly reports: churn risk semaphore + executive narrative

ALTER TABLE weekly_reports
  ADD COLUMN IF NOT EXISTS engagement_change_pct numeric(6,2),   -- vs prev week (positive = growth)
  ADD COLUMN IF NOT EXISTS churn_risk_level text
    CHECK (churn_risk_level IN ('low', 'medium', 'high')),
  ADD COLUMN IF NOT EXISTS churn_risk_factors jsonb,             -- array of factor strings
  ADD COLUMN IF NOT EXISTS executive_narrative text;             -- longer AI narrative for admin

CREATE INDEX IF NOT EXISTS idx_weekly_reports_client_churn
  ON weekly_reports (client_id, churn_risk_level, week_start DESC);


-- ===================== 0014_security_hardening.sql =====================
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
exception when duplicate_object or duplicate_table then null; end $$;

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


-- ===================== 0015_agency_settings.sql =====================
-- ============================================
-- 0015: AGENCY SETTINGS
-- Datos fiscales y de facturación de la agencia.
-- Una sola fila (se refuerza con UNIQUE(organization_id) en 0018).
-- ============================================

create table if not exists agency_settings (
  id uuid primary key default gen_random_uuid(),

  -- Identidad fiscal
  agency_name text not null,
  nif text not null,
  address text,
  city text,
  postal_code text,
  country text not null default 'ES',

  -- Contacto
  email text,
  phone text,
  logo_url text,

  -- Facturación
  iban text,
  payment_terms_days integer not null default 30,
  invoice_prefix text not null default 'INV',
  next_invoice_number integer not null default 1,
  igic_rate numeric(5,2) not null default 7.00,
  irpf_rate numeric(5,2) not null default 15.00,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table agency_settings enable row level security;

drop policy if exists "AgencySettings: admin full" on agency_settings;
create policy "AgencySettings: admin full" on agency_settings
  for all using (current_user_role() = 'admin')
  with check (current_user_role() = 'admin');

do $$ begin
  create trigger update_agency_settings_updated_at before update on agency_settings
    for each row execute function update_updated_at();
exception when duplicate_object or duplicate_table then null; end $$;


-- ===================== 0016_invoicing_fiscal.sql =====================
-- ============================================
-- 0016: DATOS FISCALES DE CLIENTES + LÍNEAS DE FACTURA
-- Solo ADD COLUMN (backward-compatible). amount integer se
-- mantiene intacto para no romper KPIs ni generate-monthly.
-- ============================================

-- Datos fiscales del cliente (para la cabecera de factura).
-- contact_phone ya existe en clients: no se duplica.
alter table clients add column if not exists fiscal_name text;
alter table clients add column if not exists nif text;
alter table clients add column if not exists fiscal_address text;
alter table clients add column if not exists fiscal_city text;
alter table clients add column if not exists fiscal_postal_code text;
alter table clients add column if not exists fiscal_country text not null default 'ES';
alter table clients add column if not exists billing_email text;

-- Líneas y desglose de impuestos.
-- Estructura de línea: { description, quantity, unit_price, tax_rate, subtotal }
-- Total real = subtotal + tax_amount (IGIC) - irpf_amount.
-- La app sincroniza amount = round(total) al guardar para mantener compatibilidad.
alter table invoices add column if not exists lines jsonb not null default '[]';
alter table invoices add column if not exists subtotal numeric(10,2);
alter table invoices add column if not exists tax_amount numeric(10,2);
alter table invoices add column if not exists irpf_amount numeric(10,2);
alter table invoices add column if not exists notes text;
alter table invoices add column if not exists sent_at timestamptz;
alter table invoices add column if not exists created_by uuid references profiles(id) on delete set null;

create index if not exists idx_invoices_status on invoices(status);


-- ===================== 0017_invoices_storage_numbering.sql =====================
-- ============================================
-- 0017: BUCKET PRIVADO 'invoices' + NUMERACIÓN ATÓMICA DE FACTURAS
-- Sin policies de storage para authenticated: todo acceso pasa por
-- service client (upload server-side, signed URLs), como el bucket
-- 'assets' tras el hardening de 0014.
-- ============================================

insert into storage.buckets (id, name, public, file_size_limit)
values ('invoices', 'invoices', false, 10485760) -- 10 MB
on conflict (id) do update set public = false;

-- ============================================
-- RPC: next_invoice_number()
-- Consume agency_settings.next_invoice_number de forma atómica
-- (UPDATE ... RETURNING toma row lock → sin carreras).
-- Formato: {prefix}-{YYYY}-{NNNN}, p.ej. INV-2026-0001.
-- Disjunto del formato legado INV-YYYY-MM-XXXXXX → sin colisiones.
-- NOTA: 0019 reemplaza esta versión por una org-aware con la misma
-- semántica para llamadas sin argumentos.
-- ============================================
create or replace function next_invoice_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text;
  v_n integer;
begin
  if not (auth.role() = 'service_role' or current_user_role() = 'admin') then
    raise exception 'no autorizado';
  end if;

  update agency_settings
     set next_invoice_number = next_invoice_number + 1,
         updated_at = now()
   returning invoice_prefix, next_invoice_number - 1
        into v_prefix, v_n;

  if not found then
    raise exception 'agency_settings_missing';
  end if;

  return v_prefix || '-' || to_char(now(), 'YYYY') || '-' || lpad(v_n::text, 4, '0');
end;
$$;


-- ===================== 0018_organizations.sql =====================
-- ============================================
-- 0018: ORGANIZATIONS (multi-agencia)
-- Backward-compatible con el código wave-A desplegado: seed con UUID
-- fijo + backfill + DEFAULT transicional → los INSERT que aún no
-- envían organization_id caen en la org seed (Logika Digital).
-- Ver ADR-006.
-- ============================================

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  plan text not null default 'agency',
  settings jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- RLS activada ya (deny-all hasta que 0019 cree las policies; el código
-- wave-A no consulta esta tabla).
alter table organizations enable row level security;

-- Seed determinista: la agencia existente. Todo el backfill apunta aquí.
insert into organizations (id, name, slug)
values ('a0000000-0000-4000-8000-000000000001', 'Logika Digital', 'logika-digital')
on conflict (id) do nothing;

-- ============================================
-- Columnas organization_id + is_owner
-- ============================================
alter table profiles add column if not exists organization_id uuid references organizations(id);
alter table profiles add column if not exists is_owner boolean not null default false;
alter table clients add column if not exists organization_id uuid references organizations(id);
alter table invoices add column if not exists organization_id uuid references organizations(id);
alter table agency_settings add column if not exists organization_id uuid references organizations(id);

-- Backfill de TODO lo existente a la org seed
update profiles set organization_id = 'a0000000-0000-4000-8000-000000000001' where organization_id is null;
update clients set organization_id = 'a0000000-0000-4000-8000-000000000001' where organization_id is null;
update invoices set organization_id = 'a0000000-0000-4000-8000-000000000001' where organization_id is null;
update agency_settings set organization_id = 'a0000000-0000-4000-8000-000000000001' where organization_id is null;

-- DEFAULT transicional: el código que aún no envía organization_id
-- (wave A en prod durante la ventana de deploy) cae en la seed.
-- Retirar en una migration futura cuando wave B esté estabilizada.
alter table profiles alter column organization_id set default 'a0000000-0000-4000-8000-000000000001';
alter table clients alter column organization_id set default 'a0000000-0000-4000-8000-000000000001';
alter table invoices alter column organization_id set default 'a0000000-0000-4000-8000-000000000001';
alter table agency_settings alter column organization_id set default 'a0000000-0000-4000-8000-000000000001';

alter table profiles alter column organization_id set not null;
alter table clients alter column organization_id set not null;
alter table invoices alter column organization_id set not null;
alter table agency_settings alter column organization_id set not null;

-- ============================================
-- Numeración de facturas por organización
-- El UNIQUE global de invoice_number pasa a UNIQUE(org, number).
-- El nombre del constraint NO se asume: se resuelve dinámicamente.
-- ============================================
do $$
declare
  v_name text;
begin
  select c.conname into v_name
  from pg_constraint c
  where c.conrelid = 'public.invoices'::regclass
    and c.contype = 'u'
    and (
      select array_agg(a.attname::text order by a.attname)
      from unnest(c.conkey) k
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k
    ) = array['invoice_number'];

  if v_name is null then
    -- Si ya existe el compuesto, esta migration ya se aplicó: no-op.
    if exists (
      select 1 from pg_constraint
      where conrelid = 'public.invoices'::regclass and conname = 'uq_invoices_org_number'
    ) then
      return;
    end if;
    raise exception 'No se encontró el constraint UNIQUE de invoices.invoice_number — revisar pg_constraint manualmente antes de continuar';
  end if;

  execute format('alter table invoices drop constraint %I', v_name);
end $$;

do $$ begin
  alter table invoices add constraint uq_invoices_org_number unique (organization_id, invoice_number);
exception when duplicate_object or duplicate_table then null; end $$;

-- Una fila de agency_settings por organización
do $$ begin
  alter table agency_settings add constraint uq_agency_settings_org unique (organization_id);
exception when duplicate_object or duplicate_table then null; end $$;

create index if not exists idx_profiles_org on profiles(organization_id);
create index if not exists idx_clients_org on clients(organization_id);
create index if not exists idx_invoices_org on invoices(organization_id);

-- ============================================
-- get_my_org_id(): org del usuario autenticado.
-- SECURITY DEFINER con owner = table owner → el SELECT interno bypasea
-- la RLS de profiles (mismo mecanismo que current_user_role(), ya en
-- prod desde 0014): sin recursión.
-- ============================================
create or replace function get_my_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from profiles where id = auth.uid()
$$;


-- ===================== 0019_rls_multi_org.sql =====================
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


-- ===================== VERIFICACION FINAL (aborta y revierte si algo falta) =====================
do $check$
declare n int;
begin
  select count(*) into n from profiles where organization_id is null;
  if n > 0 then raise exception 'profiles sin organization_id: %', n; end if;
  select count(*) into n from clients where organization_id is null;
  if n > 0 then raise exception 'clients sin organization_id: %', n; end if;
  select count(*) into n from pg_proc where proname in ('append_bruto_asset','next_invoice_number','get_my_org_id','current_user_role');
  if n < 4 then raise exception 'faltan RPCs criticas (hay % de 4)', n; end if;
  raise notice 'RECONCILIACION OK';
end
$check$;
