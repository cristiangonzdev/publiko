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
