-- Separar IG Business Account ID de Facebook Page ID
-- meta_business_id ya existía y se usaba para ambos — ahora tiene su propio campo FB
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS facebook_page_id text;

-- Actualizar la RPC get_posts_to_publish para devolver facebook_page_id
CREATE OR REPLACE FUNCTION get_posts_to_publish()
RETURNS TABLE (
  post_id uuid, client_id uuid, platform platform,
  copy text, hashtags text[], asset_id uuid,
  meta_system_user_token text,
  meta_business_id text,
  facebook_page_id text,
  content_type text,
  attempts_made int
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    p.id,
    p.client_id,
    p.platform,
    p.copy,
    p.hashtags,
    p.asset_id,
    c.meta_system_user_token,
    c.meta_business_id,
    c.facebook_page_id,
    p.content_type::text,
    COALESCE(p.retry_count, 0)
  FROM posts p
  JOIN clients c ON c.id = p.client_id
  WHERE p.status = 'scheduled'
    AND p.scheduled_at <= now()
    AND c.is_active = true;
$$;
