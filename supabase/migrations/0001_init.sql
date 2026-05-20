-- ============================================
-- Agency OS — Initial schema
-- Source spec: docs/database-schema.md
-- ============================================

-- ============================================
-- EXTENSIONES
-- ============================================
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================
-- ENUM TYPES
-- ============================================
do $$ begin
  create type user_role as enum ('admin', 'editor', 'grabador', 'cliente');
exception when duplicate_object then null; end $$;

do $$ begin
  create type client_status as enum ('lead', 'proposal_sent', 'negotiation', 'active', 'paused', 'churned');
exception when duplicate_object then null; end $$;

do $$ begin
  create type content_status as enum (
    'idea', 'approved_idea', 'brief_sent', 'recording', 'brutos_ready',
    'editing', 'delivered', 'revision', 'approved', 'scheduled', 'published', 'failed'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type content_type as enum ('reel', 'post', 'story', 'carrusel', 'gmb_post');
exception when duplicate_object then null; end $$;

do $$ begin
  create type content_origin as enum ('system', 'human');
exception when duplicate_object then null; end $$;

do $$ begin
  create type idea_angle as enum (
    'emocional', 'informativo', 'humor', 'social_proof', 'educativo',
    'aspiracional', 'detras_escenas', 'anuncio', 'opinion', 'historia'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type platform as enum ('instagram', 'facebook', 'tiktok', 'gmb');
exception when duplicate_object then null; end $$;

do $$ begin
  create type price_tier as enum ('budget', 'mid', 'premium', 'luxury');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_status as enum ('pending', 'in_progress', 'done', 'cancelled');
exception when duplicate_object then null; end $$;

-- ============================================
-- PROFILES (extiende auth.users)
-- ============================================
create table if not exists profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  role user_role not null default 'cliente',
  full_name text not null,
  email text not null,
  phone text,
  telegram_chat_id text,
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================
-- CLIENTS
-- ============================================
create table if not exists clients (
  id uuid primary key default uuid_generate_v4(),

  business_name text not null,
  slug text unique not null,
  status client_status not null default 'lead',

  contact_name text not null,
  contact_email text,
  contact_phone text,
  contact_whatsapp text,

  monthly_fee integer not null default 0,
  setup_fee integer not null default 0,
  contract_start date,
  contract_end date,
  billing_day integer default 1,
  payment_method text,

  meta_business_id text,
  meta_system_user_token text,
  drive_folder_id text,

  client_user_id uuid references profiles(id),

  assigned_editor_id uuid references profiles(id),
  assigned_grabador_id uuid references profiles(id),

  pipeline_stage text,
  pipeline_notes text,
  lost_reason text,

  current_followers jsonb default '{}',

  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ============================================
-- BRAND BRAINS
-- ============================================
create table if not exists brand_brains (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,

  identity jsonb not null default '{}',
  audience jsonb not null default '{}',
  voice jsonb not null default '{}',
  products jsonb not null default '{}',
  content_pillars jsonb not null default '[]',
  platforms jsonb not null default '{}',
  competitive jsonb not null default '{}',
  visual_identity jsonb not null default '{}',
  operations jsonb not null default '{}',
  performance_learning jsonb not null default '{
    "recent_ideas": [],
    "top_performing": {},
    "underperforming": {},
    "last_updated": null
  }',

  onboarding_completed boolean not null default false,
  onboarding_step integer not null default 1,
  onboarding_completed_at timestamptz,

  version integer not null default 1,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(client_id)
);

-- ============================================
-- ASSETS
-- ============================================
create table if not exists assets (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,

  file_name text not null,
  file_type text not null,
  file_size bigint,

  storage_type text not null,
  storage_path text not null,
  public_url text,
  drive_file_id text,

  asset_category text,
  tags text[] default '{}',
  description text,

  uploaded_by uuid references profiles(id),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ============================================
-- CONTENT IDEAS
-- ============================================
create table if not exists content_ideas (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,

  concept text not null,
  full_description text,
  content_type content_type not null,
  content_origin content_origin not null default 'system',
  angle idea_angle,

  content_pillar text,

  human_input text,

  status text not null default 'suggested',
  approved_at timestamptz,
  approved_by uuid references profiles(id),
  discarded_reason text,

  concept_hash text,
  can_recycle_after timestamptz,

  content_task_id uuid,

  published_reach integer,
  published_engagement_rate numeric(5,4),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================
-- CONTENT TASKS
-- ============================================
create table if not exists content_tasks (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  idea_id uuid references content_ideas(id),

  title text not null,
  content_type content_type not null,

  copy_options jsonb not null default '[]',
  copy_selected text,
  hashtags text[],
  cta text,

  recording_brief jsonb default '{}',
  editing_brief jsonb default '{}',

  target_platforms platform[] not null default '{instagram}',
  publish_at timestamptz,

  status content_status not null default 'idea',

  grabador_id uuid references profiles(id),
  editor_id uuid references profiles(id),

  brief_sent_at timestamptz,
  recording_started_at timestamptz,
  brutos_uploaded_at timestamptz,
  editing_started_at timestamptz,
  delivered_at timestamptz,
  approved_at timestamptz,
  published_at timestamptz,

  bruto_asset_ids uuid[] default '{}',
  final_asset_id uuid references assets(id),

  admin_notes text,
  revision_notes text,
  revision_count integer not null default 0,

  deadline timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- FK circular idea → task
do $$ begin
  alter table content_ideas
    add constraint fk_content_task
    foreign key (content_task_id)
    references content_tasks(id);
exception when duplicate_object then null; end $$;

-- ============================================
-- POSTS
-- ============================================
create table if not exists posts (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  task_id uuid not null references content_tasks(id),

  platform platform not null,
  external_post_id text,
  external_url text,

  copy text not null,
  hashtags text[],

  asset_id uuid references assets(id),

  status text not null default 'scheduled',
  scheduled_at timestamptz,
  published_at timestamptz,
  failed_at timestamptz,
  failure_reason text,
  retry_count integer not null default 0,

  reach integer,
  impressions integer,
  likes integer,
  comments integer,
  shares integer,
  saves integer,
  profile_visits integer,
  link_clicks integer,
  engagement_rate numeric(5,4),
  metrics_updated_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================
-- REVIEWS
-- ============================================
create table if not exists reviews (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,

  source text not null,
  external_id text,

  author_name text,
  rating integer,
  text text,
  review_date timestamptz,

  response_options jsonb default '[]',
  response_selected text,
  response_published_at timestamptz,
  responded_by uuid references profiles(id),

  status text not null default 'pending',
  sentiment text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================
-- WEEKLY REPORTS
-- ============================================
create table if not exists weekly_reports (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,

  week_start date not null,
  week_end date not null,

  posts_published integer not null default 0,
  total_reach integer not null default 0,
  total_impressions integer not null default 0,
  total_likes integer not null default 0,
  total_saves integer not null default 0,
  total_comments integer not null default 0,
  net_followers_gained integer not null default 0,
  avg_engagement_rate numeric(5,4),

  top_post_id uuid references posts(id),

  ai_summary text,
  ai_recommendations text,

  pdf_url text,
  pdf_generated_at timestamptz,

  sent_to_client boolean not null default false,
  sent_at timestamptz,

  created_at timestamptz not null default now()
);

-- ============================================
-- CRM ACTIVITIES
-- ============================================
create table if not exists crm_activities (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,

  activity_type text not null,
  title text not null,
  description text,
  outcome text,

  next_action text,
  next_action_date date,

  created_by uuid references profiles(id),

  created_at timestamptz not null default now()
);

-- ============================================
-- INVOICES
-- ============================================
create table if not exists invoices (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,

  invoice_number text unique not null,
  amount integer not null,
  invoice_type text not null,
  description text,

  period_start date,
  period_end date,

  status text not null default 'pending',
  due_date date,
  paid_at timestamptz,
  payment_method text,

  pdf_url text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================
-- NOTIFICATIONS LOG
-- ============================================
create table if not exists notifications (
  id uuid primary key default uuid_generate_v4(),

  user_id uuid references profiles(id),
  channel text not null,

  type text not null,
  title text not null,
  body text,
  data jsonb default '{}',

  sent boolean not null default false,
  sent_at timestamptz,
  read_at timestamptz,

  created_at timestamptz not null default now()
);

-- ============================================
-- INDEXES
-- ============================================
create index if not exists idx_clients_status on clients(status);
create index if not exists idx_clients_active on clients(is_active);
create index if not exists idx_content_tasks_client on content_tasks(client_id);
create index if not exists idx_content_tasks_status on content_tasks(status);
create index if not exists idx_content_tasks_publish_at on content_tasks(publish_at);
create index if not exists idx_posts_client on posts(client_id);
create index if not exists idx_posts_status on posts(status);
create index if not exists idx_posts_scheduled on posts(scheduled_at) where status = 'scheduled';
create index if not exists idx_content_ideas_client on content_ideas(client_id);
create index if not exists idx_content_ideas_status on content_ideas(status);
create index if not exists idx_assets_client on assets(client_id);
create index if not exists idx_reviews_client on reviews(client_id);
create index if not exists idx_reviews_status on reviews(status);
create index if not exists idx_notifications_user on notifications(user_id);

-- ============================================
-- RLS
-- ============================================
alter table profiles enable row level security;
alter table clients enable row level security;
alter table brand_brains enable row level security;
alter table assets enable row level security;
alter table content_ideas enable row level security;
alter table content_tasks enable row level security;
alter table posts enable row level security;
alter table reviews enable row level security;
alter table weekly_reports enable row level security;
alter table crm_activities enable row level security;
alter table invoices enable row level security;
alter table notifications enable row level security;

-- Helper: current role
create or replace function current_user_role()
returns user_role
language sql
stable
security definer
as $$
  select role from profiles where id = auth.uid()
$$;

-- PROFILES policies
drop policy if exists "Profiles: read own or admin" on profiles;
create policy "Profiles: read own or admin" on profiles
  for select using (
    id = auth.uid() or current_user_role() = 'admin'
  );

drop policy if exists "Profiles: update own" on profiles;
create policy "Profiles: update own" on profiles
  for update using (id = auth.uid() or current_user_role() = 'admin');

-- CLIENTS policies
drop policy if exists "Clients: admin full" on clients;
create policy "Clients: admin full" on clients
  for all using (current_user_role() = 'admin')
  with check (current_user_role() = 'admin');

drop policy if exists "Clients: editor sees assigned" on clients;
create policy "Clients: editor sees assigned" on clients
  for select using (current_user_role() = 'editor' and assigned_editor_id = auth.uid());

drop policy if exists "Clients: grabador sees assigned" on clients;
create policy "Clients: grabador sees assigned" on clients
  for select using (current_user_role() = 'grabador' and assigned_grabador_id = auth.uid());

drop policy if exists "Clients: client sees own" on clients;
create policy "Clients: client sees own" on clients
  for select using (client_user_id = auth.uid());

-- BRAND BRAINS policies (cliente puede leer la suya, admin todo)
drop policy if exists "BrandBrains: admin full" on brand_brains;
create policy "BrandBrains: admin full" on brand_brains
  for all using (current_user_role() = 'admin')
  with check (current_user_role() = 'admin');

drop policy if exists "BrandBrains: client reads own" on brand_brains;
create policy "BrandBrains: client reads own" on brand_brains
  for select using (
    exists (select 1 from clients c where c.id = brand_brains.client_id and c.client_user_id = auth.uid())
  );

-- CONTENT_TASKS / IDEAS / POSTS / ASSETS — admin total, equipo solo asignados, cliente solo suyos
drop policy if exists "Tasks: admin full" on content_tasks;
create policy "Tasks: admin full" on content_tasks
  for all using (current_user_role() = 'admin')
  with check (current_user_role() = 'admin');

drop policy if exists "Tasks: editor sees own" on content_tasks;
create policy "Tasks: editor sees own" on content_tasks
  for select using (current_user_role() = 'editor' and editor_id = auth.uid());

drop policy if exists "Tasks: grabador sees own" on content_tasks;
create policy "Tasks: grabador sees own" on content_tasks
  for select using (current_user_role() = 'grabador' and grabador_id = auth.uid());

drop policy if exists "Tasks: client sees own" on content_tasks;
create policy "Tasks: client sees own" on content_tasks
  for select using (
    exists (select 1 from clients c where c.id = content_tasks.client_id and c.client_user_id = auth.uid())
  );

drop policy if exists "Ideas: admin full" on content_ideas;
create policy "Ideas: admin full" on content_ideas
  for all using (current_user_role() = 'admin')
  with check (current_user_role() = 'admin');

drop policy if exists "Ideas: client reads own" on content_ideas;
create policy "Ideas: client reads own" on content_ideas
  for select using (
    exists (select 1 from clients c where c.id = content_ideas.client_id and c.client_user_id = auth.uid())
  );

drop policy if exists "Posts: admin full" on posts;
create policy "Posts: admin full" on posts
  for all using (current_user_role() = 'admin')
  with check (current_user_role() = 'admin');

drop policy if exists "Posts: client reads own" on posts;
create policy "Posts: client reads own" on posts
  for select using (
    exists (select 1 from clients c where c.id = posts.client_id and c.client_user_id = auth.uid())
  );

drop policy if exists "Assets: admin full" on assets;
create policy "Assets: admin full" on assets
  for all using (current_user_role() = 'admin')
  with check (current_user_role() = 'admin');

drop policy if exists "Assets: team sees by client" on assets;
create policy "Assets: team sees by client" on assets
  for select using (
    exists (
      select 1 from clients c
      where c.id = assets.client_id
        and (c.assigned_editor_id = auth.uid() or c.assigned_grabador_id = auth.uid() or c.client_user_id = auth.uid())
    )
  );

-- REVIEWS / REPORTS / CRM / INVOICES / NOTIFICATIONS — admin total + cliente solo lo suyo donde aplique
drop policy if exists "Reviews: admin full" on reviews;
create policy "Reviews: admin full" on reviews
  for all using (current_user_role() = 'admin')
  with check (current_user_role() = 'admin');

drop policy if exists "Reports: admin full" on weekly_reports;
create policy "Reports: admin full" on weekly_reports
  for all using (current_user_role() = 'admin')
  with check (current_user_role() = 'admin');

drop policy if exists "Reports: client reads own" on weekly_reports;
create policy "Reports: client reads own" on weekly_reports
  for select using (
    exists (select 1 from clients c where c.id = weekly_reports.client_id and c.client_user_id = auth.uid())
  );

drop policy if exists "CRM: admin only" on crm_activities;
create policy "CRM: admin only" on crm_activities
  for all using (current_user_role() = 'admin')
  with check (current_user_role() = 'admin');

drop policy if exists "Invoices: admin full" on invoices;
create policy "Invoices: admin full" on invoices
  for all using (current_user_role() = 'admin')
  with check (current_user_role() = 'admin');

drop policy if exists "Invoices: client reads own" on invoices;
create policy "Invoices: client reads own" on invoices
  for select using (
    exists (select 1 from clients c where c.id = invoices.client_id and c.client_user_id = auth.uid())
  );

drop policy if exists "Notifications: own only" on notifications;
create policy "Notifications: own only" on notifications
  for select using (user_id = auth.uid() or current_user_role() = 'admin');

-- ============================================
-- TRIGGERS: auto-actualizar updated_at
-- ============================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$ begin
  create trigger update_profiles_updated_at before update on profiles
    for each row execute function update_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger update_clients_updated_at before update on clients
    for each row execute function update_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger update_brand_brains_updated_at before update on brand_brains
    for each row execute function update_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger update_content_tasks_updated_at before update on content_tasks
    for each row execute function update_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger update_content_ideas_updated_at before update on content_ideas
    for each row execute function update_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger update_posts_updated_at before update on posts
    for each row execute function update_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger update_assets_updated_at before update on assets
    for each row execute function update_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger update_reviews_updated_at before update on reviews
    for each row execute function update_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger update_invoices_updated_at before update on invoices
    for each row execute function update_updated_at();
exception when duplicate_object then null; end $$;

-- ============================================
-- RPCs
-- ============================================
create or replace function get_mrr_total()
returns integer
language sql
security definer
as $$
  select coalesce(sum(monthly_fee), 0)::integer
  from clients
  where status = 'active' and is_active = true;
$$;

create or replace function get_upcoming_renewals(days_ahead integer default 30)
returns table(client_id uuid, business_name text, monthly_fee integer, renewal_date date)
language sql
security definer
as $$
  select c.id, c.business_name, c.monthly_fee,
    (date_trunc('month', now()) + ((coalesce(c.billing_day, 1) - 1) || ' days')::interval)::date as renewal_date
  from clients c
  where c.status = 'active'
    and coalesce(c.billing_day, 1) between
      extract(day from now())::integer
      and extract(day from now())::integer + days_ahead;
$$;

create or replace function get_posts_to_publish()
returns table(
  post_id uuid, client_id uuid, platform platform,
  copy text, hashtags text[], asset_id uuid,
  meta_system_user_token text, meta_business_id text
)
language sql
security definer
as $$
  select
    p.id, p.client_id, p.platform,
    p.copy, p.hashtags, p.asset_id,
    c.meta_system_user_token, c.meta_business_id
  from posts p
  join clients c on c.id = p.client_id
  where p.status = 'scheduled'
    and p.scheduled_at <= now()
    and c.is_active = true;
$$;
