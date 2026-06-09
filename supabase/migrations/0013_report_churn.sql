-- Weekly reports: churn risk semaphore + executive narrative

ALTER TABLE weekly_reports
  ADD COLUMN IF NOT EXISTS engagement_change_pct numeric(6,2),   -- vs prev week (positive = growth)
  ADD COLUMN IF NOT EXISTS churn_risk_level text
    CHECK (churn_risk_level IN ('low', 'medium', 'high')),
  ADD COLUMN IF NOT EXISTS churn_risk_factors jsonb,             -- array of factor strings
  ADD COLUMN IF NOT EXISTS executive_narrative text;             -- longer AI narrative for admin

CREATE INDEX IF NOT EXISTS idx_weekly_reports_client_churn
  ON weekly_reports (client_id, churn_risk_level, week_start DESC);
