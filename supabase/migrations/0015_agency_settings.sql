-- ============================================
-- 0015: AGENCY SETTINGS
-- Datos fiscales y de facturación de la agencia.
-- Una sola fila (se refuerza con UNIQUE(organization_id) en 0018).
-- ============================================

create table if not exists agency_settings (
  id uuid primary key default gen_random_uuid(),

  -- Identidad fiscal
  agency_name text not null,
  nif text not null,
  address text,
  city text,
  postal_code text,
  country text not null default 'ES',

  -- Contacto
  email text,
  phone text,
  logo_url text,

  -- Facturación
  iban text,
  payment_terms_days integer not null default 30,
  invoice_prefix text not null default 'INV',
  next_invoice_number integer not null default 1,
  igic_rate numeric(5,2) not null default 7.00,
  irpf_rate numeric(5,2) not null default 15.00,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table agency_settings enable row level security;

drop policy if exists "AgencySettings: admin full" on agency_settings;
create policy "AgencySettings: admin full" on agency_settings
  for all using (current_user_role() = 'admin')
  with check (current_user_role() = 'admin');

do $$ begin
  create trigger update_agency_settings_updated_at before update on agency_settings
    for each row execute function update_updated_at();
exception when duplicate_object then null; end $$;
