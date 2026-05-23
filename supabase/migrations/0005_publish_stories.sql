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
