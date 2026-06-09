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
