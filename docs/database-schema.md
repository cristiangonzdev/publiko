# Database Schema — Supabase PostgreSQL

## Convenciones

- UUIDs para todos los IDs primarios
- `created_at` y `updated_at` en todas las tablas
- RLS (Row Level Security) activado en todas las tablas
- Soft delete con `deleted_at` donde aplica
- JSONB para datos flexibles (brand brain sections, metrics)

---

## Schema completo

```sql
-- ============================================
-- EXTENSIONES
-- ============================================
create extension if not exists "uuid-ossp";

-- ============================================
-- ENUM TYPES
-- ============================================
create type user_role as enum ('admin', 'editor', 'grabador', 'cliente');
create type client_status as enum ('lead', 'proposal_sent', 'negotiation', 'active', 'paused', 'churned');
create type content_status as enum ('idea', 'approved_idea', 'brief_sent', 'recording', 'brutos_ready', 'editing', 'delivered', 'revision', 'approved', 'scheduled', 'published', 'failed');
create type content_type as enum ('reel', 'post', 'story', 'carrusel', 'gmb_post');
create type content_origin as enum ('system', 'human');
create type idea_angle as enum ('emocional', 'informativo', 'humor', 'social_proof', 'educativo', 'aspiracional', 'detras_escenas', 'anuncio', 'opinion', 'historia');
create type platform as enum ('instagram', 'facebook', 'tiktok', 'gmb');
create type price_tier as enum ('budget', 'mid', 'premium', 'luxury');
create type task_status as enum ('pending', 'in_progress', 'done', 'cancelled');

-- ============================================
-- PROFILES (extiende auth.users de Supabase)
-- ============================================
create table profiles (
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
-- CLIENTS (ficha del cliente/negocio)
-- ============================================
create table clients (
  id uuid primary key default uuid_generate_v4(),
  
  -- Datos básicos
  business_name text not null,
  slug text unique not null,              -- para URLs y carpetas de Drive
  status client_status not null default 'lead',
  
  -- Contacto principal
  contact_name text not null,
  contact_email text,
  contact_phone text,
  contact_whatsapp text,
  
  -- Contrato y facturación
  monthly_fee integer not null default 0, -- en euros
  setup_fee integer not null default 0,
  contract_start date,
  contract_end date,
  billing_day integer default 1,          -- día del mes para facturar
  payment_method text,
  
  -- Accesos
  meta_business_id text,
  meta_system_user_token text,
  drive_folder_id text,                   -- carpeta raíz en Google Drive
  
  -- Usuario cliente (para el portal)
  client_user_id uuid references profiles(id),
  
  -- Asignaciones internas
  assigned_editor_id uuid references profiles(id),
  assigned_grabador_id uuid references profiles(id),
  
  -- Pipeline CRM
  pipeline_stage text,
  pipeline_notes text,
  lost_reason text,
  
  -- Métricas snapshot (actualizado por n8n mensualmente)
  current_followers jsonb default '{}',  -- {"instagram": 2400, "facebook": 890}
  
  -- Control
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ============================================
-- BRAND BRAINS (ficha completa por cliente)
-- ============================================
create table brand_brains (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  
  -- Secciones del brand brain (JSONB)
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
  
  -- Control de completitud del onboarding
  onboarding_completed boolean not null default false,
  onboarding_step integer not null default 1,
  onboarding_completed_at timestamptz,
  
  -- Version para tracking de cambios
  version integer not null default 1,
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  unique(client_id)
);

-- ============================================
-- ASSETS (banco de archivos por cliente)
-- ============================================
create table assets (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  
  -- Archivo
  file_name text not null,
  file_type text not null,               -- 'video/mp4', 'image/jpeg'...
  file_size bigint,                      -- en bytes
  
  -- Ubicación
  storage_type text not null,            -- 'supabase_storage' | 'google_drive'
  storage_path text not null,            -- path en storage o ID de Drive
  public_url text,
  drive_file_id text,
  
  -- Metadatos
  asset_category text,                   -- 'bruto', 'editado', 'foto_producto', 'foto_ambiente', 'logo', 'referencia'
  tags text[] default '{}',
  description text,
  
  -- Quién lo subió
  uploaded_by uuid references profiles(id),
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ============================================
-- CONTENT IDEAS (banco de ideas)
-- ============================================
create table content_ideas (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  
  -- Contenido de la idea
  concept text not null,                 -- Concepto central en 1 línea
  full_description text,                 -- Descripción completa de la idea
  content_type content_type not null,
  content_origin content_origin not null default 'system',
  angle idea_angle,
  
  -- Pillar de contenido al que pertenece
  content_pillar text,
  
  -- Para ideas HUMANO
  human_input text,                      -- Lo que el humano aportó como base
  
  -- Status y flujo
  status text not null default 'suggested', -- suggested | approved | in_production | published | discarded | recycled
  approved_at timestamptz,
  approved_by uuid references profiles(id),
  discarded_reason text,
  
  -- Evitar repetición
  concept_hash text,                     -- Hash del concepto para deduplicación
  can_recycle_after timestamptz,         -- Fecha desde la que se puede reutilizar
  
  -- Referencia a contenido producido (si se aprobó)
  content_task_id uuid,                  -- FK a content_tasks (se añade después)
  
  -- Performance (si llegó a publicarse)
  published_reach integer,
  published_engagement_rate numeric(5,4),
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================
-- CONTENT TASKS (pipeline de producción)
-- ============================================
create table content_tasks (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  idea_id uuid references content_ideas(id),
  
  -- Descripción
  title text not null,
  content_type content_type not null,
  
  -- Copy generado por Claude
  copy_options jsonb not null default '[]', -- Array de 3 opciones de copy
  copy_selected text,                    -- El copy que se aprueba
  hashtags text[],
  cta text,
  
  -- Brief de grabación
  recording_brief jsonb default '{}', -- {concept, planes, duracion, musica, referencia, prep_notes}
  
  -- Brief de edición
  editing_brief jsonb default '{}',  -- {ritmo, transiciones, texto_pantalla, musica_exacta, duracion_final}
  
  -- Plataforma y programación
  target_platforms platform[] not null default '{instagram}',
  publish_at timestamptz,
  
  -- Status del pipeline
  status content_status not null default 'idea',
  
  -- Asignaciones
  grabador_id uuid references profiles(id),
  editor_id uuid references profiles(id),
  
  -- Fechas de cada paso
  brief_sent_at timestamptz,
  recording_started_at timestamptz,
  brutos_uploaded_at timestamptz,
  editing_started_at timestamptz,
  delivered_at timestamptz,
  approved_at timestamptz,
  published_at timestamptz,
  
  -- Assets relacionados
  bruto_asset_ids uuid[] default '{}',
  final_asset_id uuid references assets(id),
  
  -- Notas y revisiones
  admin_notes text,
  revision_notes text,
  revision_count integer not null default 0,
  
  -- Deadline
  deadline timestamptz,
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- FK circular (idea → task)
alter table content_ideas
  add constraint fk_content_task
  foreign key (content_task_id)
  references content_tasks(id);

-- ============================================
-- POSTS (registro de publicaciones)
-- ============================================
create table posts (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  task_id uuid not null references content_tasks(id),
  
  -- Publicación
  platform platform not null,
  external_post_id text,                 -- ID del post en Meta/TikTok
  external_url text,                     -- URL del post publicado
  
  -- Copy publicado
  copy text not null,
  hashtags text[],
  
  -- Asset publicado
  asset_id uuid references assets(id),
  
  -- Status
  status text not null default 'scheduled', -- scheduled | published | failed
  scheduled_at timestamptz,
  published_at timestamptz,
  failed_at timestamptz,
  failure_reason text,
  
  -- Métricas (actualizadas por n8n)
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
-- REVIEWS (reseñas de Google/TripAdvisor)
-- ============================================
create table reviews (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  
  -- Fuente
  source text not null,                  -- 'google' | 'tripadvisor' | 'instagram'
  external_id text,                      -- ID externo de la reseña
  
  -- Contenido
  author_name text,
  rating integer,                        -- 1-5
  text text,
  review_date timestamptz,
  
  -- Respuesta
  response_options jsonb default '[]',   -- Array de 2-3 opciones generadas por Claude
  response_selected text,
  response_published_at timestamptz,
  responded_by uuid references profiles(id),
  
  -- Status
  status text not null default 'pending', -- pending | responded | ignored
  sentiment text,                        -- positive | neutral | negative (clasificado por Claude)
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================
-- WEEKLY REPORTS (informes semanales)
-- ============================================
create table weekly_reports (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  
  -- Período
  week_start date not null,
  week_end date not null,
  
  -- Datos del informe
  posts_published integer not null default 0,
  total_reach integer not null default 0,
  total_impressions integer not null default 0,
  total_likes integer not null default 0,
  total_saves integer not null default 0,
  total_comments integer not null default 0,
  net_followers_gained integer not null default 0,
  avg_engagement_rate numeric(5,4),
  
  -- Post destacado
  top_post_id uuid references posts(id),
  
  -- Análisis generado por Claude
  ai_summary text,                       -- Resumen narrativo del rendimiento
  ai_recommendations text,              -- Recomendaciones para la semana siguiente
  
  -- PDF generado
  pdf_url text,
  pdf_generated_at timestamptz,
  
  -- Envío al cliente
  sent_to_client boolean not null default false,
  sent_at timestamptz,
  
  created_at timestamptz not null default now()
);

-- ============================================
-- CRM PIPELINE (pipeline de ventas del admin)
-- ============================================
create table crm_activities (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  
  -- Actividad
  activity_type text not null,           -- 'call' | 'email' | 'meeting' | 'proposal' | 'note' | 'whatsapp'
  title text not null,
  description text,
  outcome text,
  
  -- Seguimiento
  next_action text,
  next_action_date date,
  
  -- Quién
  created_by uuid references profiles(id),
  
  created_at timestamptz not null default now()
);

-- ============================================
-- INVOICES (facturación)
-- ============================================
create table invoices (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  
  -- Factura
  invoice_number text unique not null,
  amount integer not null,               -- en euros
  invoice_type text not null,            -- 'setup' | 'monthly' | 'extra'
  description text,
  
  -- Período facturado
  period_start date,
  period_end date,
  
  -- Status
  status text not null default 'pending', -- pending | sent | paid | overdue | cancelled
  due_date date,
  paid_at timestamptz,
  payment_method text,
  
  -- Documento
  pdf_url text,
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================
-- NOTIFICATIONS LOG
-- ============================================
create table notifications (
  id uuid primary key default uuid_generate_v4(),
  
  -- Destinatario
  user_id uuid references profiles(id),
  channel text not null,                 -- 'telegram' | 'email' | 'in_app'
  
  -- Contenido
  type text not null,                    -- tipo de notificación para lógica del cliente
  title text not null,
  body text,
  data jsonb default '{}',               -- datos adicionales
  
  -- Status
  sent boolean not null default false,
  sent_at timestamptz,
  read_at timestamptz,
  
  created_at timestamptz not null default now()
);

-- ============================================
-- INDEXES
-- ============================================
create index idx_clients_status on clients(status);
create index idx_clients_active on clients(is_active);
create index idx_content_tasks_client on content_tasks(client_id);
create index idx_content_tasks_status on content_tasks(status);
create index idx_content_tasks_publish_at on content_tasks(publish_at);
create index idx_posts_client on posts(client_id);
create index idx_posts_status on posts(status);
create index idx_posts_scheduled on posts(scheduled_at) where status = 'scheduled';
create index idx_content_ideas_client on content_ideas(client_id);
create index idx_content_ideas_status on content_ideas(status);
create index idx_assets_client on assets(client_id);
create index idx_reviews_client on reviews(client_id);
create index idx_reviews_status on reviews(status);

-- ============================================
-- RLS POLICIES
-- ============================================

-- Activar RLS en todas las tablas
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

-- Admin: acceso total
create policy "Admin full access" on clients
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- Editor: solo sus clientes asignados
create policy "Editor sees assigned clients" on clients
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'editor')
    and assigned_editor_id = auth.uid()
  );

-- Grabador: solo sus clientes asignados
create policy "Grabador sees assigned clients" on clients
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'grabador')
    and assigned_grabador_id = auth.uid()
  );

-- Cliente: solo su propio registro
create policy "Client sees own data" on clients
  for select using (client_user_id = auth.uid());

-- Política similar para content_tasks (ver docs completos para el resto)

-- ============================================
-- FUNCTIONS Y TRIGGERS
-- ============================================

-- Auto-actualizar updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Aplicar trigger a todas las tablas con updated_at
create trigger update_clients_updated_at before update on clients
  for each row execute function update_updated_at();

create trigger update_brand_brains_updated_at before update on brand_brains
  for each row execute function update_updated_at();

create trigger update_content_tasks_updated_at before update on content_tasks
  for each row execute function update_updated_at();

create trigger update_posts_updated_at before update on posts
  for each row execute function update_updated_at();

-- RPC: Calcular MRR total (para el panel de admin)
create or replace function get_mrr_total()
returns integer as $$
  select coalesce(sum(monthly_fee), 0)
  from clients
  where status = 'active' and is_active = true;
$$ language sql security definer;

-- RPC: Clientes con renovación próxima
create or replace function get_upcoming_renewals(days_ahead integer default 30)
returns table(client_id uuid, business_name text, monthly_fee integer, renewal_date date) as $$
  select c.id, c.business_name, c.monthly_fee,
    (date_trunc('month', now()) + (c.billing_day - 1 || ' days')::interval)::date as renewal_date
  from clients c
  where c.status = 'active'
    and c.billing_day between 
      extract(day from now())::integer 
      and extract(day from now())::integer + days_ahead;
$$ language sql security definer;

-- RPC: Posts pendientes de publicar (para el scheduler de n8n)
create or replace function get_posts_to_publish()
returns table(
  post_id uuid, client_id uuid, platform platform, 
  copy text, hashtags text[], asset_id uuid,
  meta_system_user_token text, meta_business_id text
) as $$
  select 
    p.id, p.client_id, p.platform, 
    p.copy, p.hashtags, p.asset_id,
    c.meta_system_user_token, c.meta_business_id
  from posts p
  join clients c on c.id = p.client_id
  where p.status = 'scheduled'
    and p.scheduled_at <= now()
    and c.is_active = true;
$$ language sql security definer;
```

---

## Drive Folder Structure (por cliente)

```
/Agency OS (root)
  /{client_slug}/
    /brutos/           ← Grabador sube aquí los vídeos crudos
    /editados/         ← Editor sube aquí los entregables
    /publicados/       ← n8n mueve aquí tras publicar
    /assets/
      /fotos/
      /referencias/
    /reportes/         ← PDFs semanales guardados
```

El `drive_folder_id` en `clients` apunta a `/{client_slug}/`. El sistema crea esta estructura automáticamente durante el onboarding.

---

## Facturación y multi-agencia (migrations 0015–0019)

El SQL de arriba refleja el schema base de 0001. Las migrations 0015–0019 añaden lo siguiente (el SQL completo está en `supabase/migrations/`).

### ORGANIZATIONS (multi-agencia) — 0018

```sql
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  plan text not null default 'agency',
  settings jsonb not null default '{}',
  created_at timestamptz not null default now()
);
-- Seed determinista: 'a0000000-0000-4000-8000-000000000001' = Logika Digital.
-- Todos los datos pre-existentes quedaron backfilleados a esta org.
```

Columnas añadidas (NOT NULL, con DEFAULT transicional a la org seed):
- `profiles.organization_id` → organizations + `profiles.is_owner boolean default false`
- `clients.organization_id` → organizations
- `invoices.organization_id` → organizations (UNIQUE pasa de `invoice_number` global a `(organization_id, invoice_number)`)
- `agency_settings.organization_id` → organizations (+ `UNIQUE(organization_id)`: una fila por org)

Las demás tablas heredan la organización vía join a `clients` — no llevan `organization_id` propio.

### AGENCY_SETTINGS (datos fiscales de la agencia) — 0015

```sql
create table agency_settings (
  id uuid primary key default gen_random_uuid(),
  agency_name text not null,
  nif text not null,
  address text, city text, postal_code text, country text not null default 'ES',
  email text, phone text, logo_url text,
  iban text,
  payment_terms_days integer not null default 30,
  invoice_prefix text not null default 'INV',
  next_invoice_number integer not null default 1,
  igic_rate numeric(5,2) not null default 7.00,
  irpf_rate numeric(5,2) not null default 15.00,
  organization_id uuid not null references organizations(id),  -- 0018
  created_at timestamptz, updated_at timestamptz
);
```

### Columnas nuevas en CLIENTS (fiscales) — 0016

`fiscal_name`, `nif`, `fiscal_address`, `fiscal_city`, `fiscal_postal_code`, `fiscal_country default 'ES'`, `billing_email` (todas text, nullables).

### Columnas nuevas en INVOICES (líneas y desglose) — 0016

```sql
lines jsonb not null default '[]',  -- [{ description, quantity, unit_price, tax_rate, subtotal }]
subtotal numeric(10,2),
tax_amount numeric(10,2),           -- IGIC
irpf_amount numeric(10,2),
notes text,
sent_at timestamptz,
created_by uuid references profiles(id) on delete set null
-- amount (integer) se mantiene = round(subtotal + tax_amount - irpf_amount)
-- pdf_url guarda el PATH del bucket privado 'invoices', nunca una URL.
```

### RLS multi-org — 0019

Patrón de las policies de admin (las policies por rol no cambiaron):

```sql
-- Tablas con organization_id directo:
create policy "Clients: org admin full" on clients
  for all using (current_user_role() = 'admin' and organization_id = get_my_org_id())
  with check (current_user_role() = 'admin' and organization_id = get_my_org_id());

-- Tablas hijas (vía join a clients):
create policy "Tasks: org admin full" on content_tasks
  for all using (
    current_user_role() = 'admin'
    and exists (select 1 from clients c
                where c.id = content_tasks.client_id
                  and c.organization_id = get_my_org_id())
  ) with check ( /* misma expresión */ );

-- notifications: select solo user_id = auth.uid() (sin OR admin)
-- organizations: select para miembros (id = get_my_org_id()), update solo admin de su org
```

### Funciones nuevas / actualizadas

```sql
-- Org del usuario autenticado (SECURITY DEFINER, sin recursión — mismo patrón que current_user_role)
get_my_org_id() returns uuid

-- Numeración atómica por org: UPDATE ... RETURNING con row lock.
-- admin → deriva su org; service_role → exige p_org. Formato {prefix}-{YYYY}-{NNNN}.
next_invoice_number(p_org uuid default null) returns text

-- Org-aware para admin, globales para service_role (crons):
get_mrr_total() / get_upcoming_renewals(days_ahead)
```

### Storage

Bucket `invoices` (0017): privado, 10 MB, sin policies para authenticated — upload server-side con service client y lectura solo vía signed URLs (igual que `assets` tras 0014).
