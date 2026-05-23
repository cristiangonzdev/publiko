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
exception when duplicate_object then null; end $$;

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
exception when duplicate_object then null; end $$;

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
exception when duplicate_object then null; end $$;

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
