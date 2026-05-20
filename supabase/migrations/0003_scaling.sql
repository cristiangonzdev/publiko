-- ============================================
-- 0003 — Scaling: tiered approval, multi-platform copy, AI judge, daily cadence
-- ============================================
-- Additive only — no drops, no type changes. Existing rows fall back to safe
-- defaults so the platform keeps working with or without the new code paths.

-- ============================================
-- CONTENT TASKS — approval tier + per-platform copy + AI judge result
-- ============================================
alter table content_tasks
  add column if not exists approval_tier text not null default 'manual',
  add column if not exists copies_per_platform jsonb not null default '{}'::jsonb,
  add column if not exists judge_verdict jsonb,
  add column if not exists judge_run_at timestamptz,
  add column if not exists auto_publish_blocked_reason text;

-- approval_tier sanity (no enum so columns survive future tier additions)
do $$ begin
  alter table content_tasks
    add constraint content_tasks_approval_tier_check
    check (approval_tier in ('auto', 'manual'));
exception when duplicate_object then null; end $$;

-- ============================================
-- CONTENT IDEAS — approval tier (mirrors task) + cron-tracking date
-- ============================================
alter table content_ideas
  add column if not exists approval_tier text not null default 'manual',
  add column if not exists scheduled_for_date date;

do $$ begin
  alter table content_ideas
    add constraint content_ideas_approval_tier_check
    check (approval_tier in ('auto', 'manual'));
exception when duplicate_object then null; end $$;

create index if not exists idx_content_ideas_scheduled_date
  on content_ideas(scheduled_for_date)
  where scheduled_for_date is not null;

-- ============================================
-- CLIENTS — daily generation config
-- ============================================
-- Shape (example):
-- {
--   "reels_per_day": 2,
--   "posts_per_day": 1,
--   "stories_per_day": 4,
--   "auto_tier_content_types": ["story"],
--   "publish_hours": ["09:00", "14:00", "20:00"],
--   "platforms": ["instagram", "facebook"]
-- }
-- Empty {} means daily generation is DISABLED for this client.
alter table clients
  add column if not exists daily_generation_config jsonb not null default '{}'::jsonb;
