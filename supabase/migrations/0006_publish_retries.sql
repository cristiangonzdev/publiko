-- ============================================
-- 0006 — Reintentos de publicación + observabilidad
-- ============================================
-- Backoff exponencial: 15min, 1h, 4h. Después → status='failed' + alerta admin.

alter table posts
  add column if not exists scheduled_retry_at timestamptz,
  add column if not exists last_attempt_at timestamptz;

create index if not exists idx_posts_retry_due
  on posts(scheduled_retry_at)
  where scheduled_retry_at is not null and status = 'scheduled';

-- get_posts_to_publish: incluye tanto scheduled normales como los que toca reintentar
drop function if exists get_posts_to_publish();

-- attempts_made es el nombre del OUT param para evitar colisión con posts.retry_count
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
  meta_business_id text,
  attempts_made integer
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
    c.meta_business_id,
    p.retry_count
  from posts p
  join clients c on c.id = p.client_id
  left join content_tasks ct on ct.id = p.task_id
  where p.status = 'scheduled'
    and c.is_active = true
    and (
      (p.scheduled_at <= now() and p.scheduled_retry_at is null)
      or
      (p.scheduled_retry_at is not null and p.scheduled_retry_at <= now() and p.retry_count < 3)
    );
$$;
