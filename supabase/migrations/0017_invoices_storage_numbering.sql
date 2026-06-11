-- ============================================
-- 0017: BUCKET PRIVADO 'invoices' + NUMERACIÓN ATÓMICA DE FACTURAS
-- Sin policies de storage para authenticated: todo acceso pasa por
-- service client (upload server-side, signed URLs), como el bucket
-- 'assets' tras el hardening de 0014.
-- ============================================

insert into storage.buckets (id, name, public, file_size_limit)
values ('invoices', 'invoices', false, 10485760) -- 10 MB
on conflict (id) do update set public = false;

-- ============================================
-- RPC: next_invoice_number()
-- Consume agency_settings.next_invoice_number de forma atómica
-- (UPDATE ... RETURNING toma row lock → sin carreras).
-- Formato: {prefix}-{YYYY}-{NNNN}, p.ej. INV-2026-0001.
-- Disjunto del formato legado INV-YYYY-MM-XXXXXX → sin colisiones.
-- NOTA: 0019 reemplaza esta versión por una org-aware con la misma
-- semántica para llamadas sin argumentos.
-- ============================================
create or replace function next_invoice_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text;
  v_n integer;
begin
  if not (auth.role() = 'service_role' or current_user_role() = 'admin') then
    raise exception 'no autorizado';
  end if;

  update agency_settings
     set next_invoice_number = next_invoice_number + 1,
         updated_at = now()
   returning invoice_prefix, next_invoice_number - 1
        into v_prefix, v_n;

  if not found then
    raise exception 'agency_settings_missing';
  end if;

  return v_prefix || '-' || to_char(now(), 'YYYY') || '-' || lpad(v_n::text, 4, '0');
end;
$$;
