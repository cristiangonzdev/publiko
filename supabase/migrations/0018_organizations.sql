-- ============================================
-- 0018: ORGANIZATIONS (multi-agencia)
-- Backward-compatible con el código wave-A desplegado: seed con UUID
-- fijo + backfill + DEFAULT transicional → los INSERT que aún no
-- envían organization_id caen en la org seed (Logika Digital).
-- Ver ADR-006.
-- ============================================

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  plan text not null default 'agency',
  settings jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- RLS activada ya (deny-all hasta que 0019 cree las policies; el código
-- wave-A no consulta esta tabla).
alter table organizations enable row level security;

-- Seed determinista: la agencia existente. Todo el backfill apunta aquí.
insert into organizations (id, name, slug)
values ('a0000000-0000-4000-8000-000000000001', 'Logika Digital', 'logika-digital')
on conflict (id) do nothing;

-- ============================================
-- Columnas organization_id + is_owner
-- ============================================
alter table profiles add column if not exists organization_id uuid references organizations(id);
alter table profiles add column if not exists is_owner boolean not null default false;
alter table clients add column if not exists organization_id uuid references organizations(id);
alter table invoices add column if not exists organization_id uuid references organizations(id);
alter table agency_settings add column if not exists organization_id uuid references organizations(id);

-- Backfill de TODO lo existente a la org seed
update profiles set organization_id = 'a0000000-0000-4000-8000-000000000001' where organization_id is null;
update clients set organization_id = 'a0000000-0000-4000-8000-000000000001' where organization_id is null;
update invoices set organization_id = 'a0000000-0000-4000-8000-000000000001' where organization_id is null;
update agency_settings set organization_id = 'a0000000-0000-4000-8000-000000000001' where organization_id is null;

-- DEFAULT transicional: el código que aún no envía organization_id
-- (wave A en prod durante la ventana de deploy) cae en la seed.
-- Retirar en una migration futura cuando wave B esté estabilizada.
alter table profiles alter column organization_id set default 'a0000000-0000-4000-8000-000000000001';
alter table clients alter column organization_id set default 'a0000000-0000-4000-8000-000000000001';
alter table invoices alter column organization_id set default 'a0000000-0000-4000-8000-000000000001';
alter table agency_settings alter column organization_id set default 'a0000000-0000-4000-8000-000000000001';

alter table profiles alter column organization_id set not null;
alter table clients alter column organization_id set not null;
alter table invoices alter column organization_id set not null;
alter table agency_settings alter column organization_id set not null;

-- ============================================
-- Numeración de facturas por organización
-- El UNIQUE global de invoice_number pasa a UNIQUE(org, number).
-- El nombre del constraint NO se asume: se resuelve dinámicamente.
-- ============================================
do $$
declare
  v_name text;
begin
  select c.conname into v_name
  from pg_constraint c
  where c.conrelid = 'public.invoices'::regclass
    and c.contype = 'u'
    and (
      select array_agg(a.attname order by a.attname)
      from unnest(c.conkey) k
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k
    ) = array['invoice_number'];

  if v_name is null then
    -- Si ya existe el compuesto, esta migration ya se aplicó: no-op.
    if exists (
      select 1 from pg_constraint
      where conrelid = 'public.invoices'::regclass and conname = 'uq_invoices_org_number'
    ) then
      return;
    end if;
    raise exception 'No se encontró el constraint UNIQUE de invoices.invoice_number — revisar pg_constraint manualmente antes de continuar';
  end if;

  execute format('alter table invoices drop constraint %I', v_name);
end $$;

do $$ begin
  alter table invoices add constraint uq_invoices_org_number unique (organization_id, invoice_number);
exception when duplicate_object or duplicate_table then null; end $$;

-- Una fila de agency_settings por organización
do $$ begin
  alter table agency_settings add constraint uq_agency_settings_org unique (organization_id);
exception when duplicate_object or duplicate_table then null; end $$;

create index if not exists idx_profiles_org on profiles(organization_id);
create index if not exists idx_clients_org on clients(organization_id);
create index if not exists idx_invoices_org on invoices(organization_id);

-- ============================================
-- get_my_org_id(): org del usuario autenticado.
-- SECURITY DEFINER con owner = table owner → el SELECT interno bypasea
-- la RLS de profiles (mismo mecanismo que current_user_role(), ya en
-- prod desde 0014): sin recursión.
-- ============================================
create or replace function get_my_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from profiles where id = auth.uid()
$$;
