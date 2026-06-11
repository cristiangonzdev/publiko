-- ============================================
-- 0016: DATOS FISCALES DE CLIENTES + LÍNEAS DE FACTURA
-- Solo ADD COLUMN (backward-compatible). amount integer se
-- mantiene intacto para no romper KPIs ni generate-monthly.
-- ============================================

-- Datos fiscales del cliente (para la cabecera de factura).
-- contact_phone ya existe en clients: no se duplica.
alter table clients add column if not exists fiscal_name text;
alter table clients add column if not exists nif text;
alter table clients add column if not exists fiscal_address text;
alter table clients add column if not exists fiscal_city text;
alter table clients add column if not exists fiscal_postal_code text;
alter table clients add column if not exists fiscal_country text not null default 'ES';
alter table clients add column if not exists billing_email text;

-- Líneas y desglose de impuestos.
-- Estructura de línea: { description, quantity, unit_price, tax_rate, subtotal }
-- Total real = subtotal + tax_amount (IGIC) - irpf_amount.
-- La app sincroniza amount = round(total) al guardar para mantener compatibilidad.
alter table invoices add column if not exists lines jsonb not null default '[]';
alter table invoices add column if not exists subtotal numeric(10,2);
alter table invoices add column if not exists tax_amount numeric(10,2);
alter table invoices add column if not exists irpf_amount numeric(10,2);
alter table invoices add column if not exists notes text;
alter table invoices add column if not exists sent_at timestamptz;
alter table invoices add column if not exists created_by uuid references profiles(id) on delete set null;

create index if not exists idx_invoices_status on invoices(status);
