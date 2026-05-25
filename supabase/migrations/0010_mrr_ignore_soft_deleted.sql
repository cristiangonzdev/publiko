-- Fix: el RPC get_mrr_total seguía contando clientes con deleted_at != null.
-- También endurecemos get_upcoming_renewals con el mismo criterio.

create or replace function get_mrr_total()
returns integer
language sql
security definer
as $$
  select coalesce(sum(monthly_fee), 0)::integer
  from clients
  where status = 'active'
    and is_active = true
    and deleted_at is null;
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
    and c.is_active = true
    and c.deleted_at is null
    and coalesce(c.billing_day, 1) between
      extract(day from now())::integer
      and extract(day from now() + (days_ahead || ' days')::interval)::integer;
$$;
