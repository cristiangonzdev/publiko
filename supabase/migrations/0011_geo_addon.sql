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
