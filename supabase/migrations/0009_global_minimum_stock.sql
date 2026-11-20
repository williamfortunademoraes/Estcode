alter table public.inventory_settings
  add column global_minimum_stock numeric(14, 3) not null default 0,
  add constraint global_minimum_stock_nonnegative
    check (global_minimum_stock >= 0);

create or replace function public.get_inventory_dashboard(p_inventory_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
  global_minimum numeric(14, 3);
begin
  perform public.assert_active_user();
  if not exists (select 1 from public.inventories where id = p_inventory_id and active) then
    raise exception 'inventory_not_found' using errcode = '22023';
  end if;
  select coalesce(s.global_minimum_stock, 0) into global_minimum
  from public.inventory_settings s where s.inventory_id = p_inventory_id;
  global_minimum := coalesce(global_minimum, 0);

  select jsonb_build_object(
    'total_products', (select count(*) from public.products where active),
    'total_quantity', coalesce((select sum(quantity) from public.stock_balances where inventory_id = p_inventory_id), 0),
    'below_minimum', coalesce((
      select count(*) from public.products p
      left join public.stock_balances b on b.product_id = p.id and b.inventory_id = p_inventory_id
      where p.active and coalesce(b.quantity, 0) <= coalesce(nullif(p.minimum_stock, 0), global_minimum)
    ), 0),
    'entries_30d', coalesce((select sum(quantity) from public.stock_movements where inventory_id = p_inventory_id and movement_type = 'entry' and created_at >= timezone('utc', now()) - interval '30 days'), 0),
    'exits_30d', coalesce((select sum(quantity) from public.stock_movements where inventory_id = p_inventory_id and movement_type = 'exit' and created_at >= timezone('utc', now()) - interval '30 days'), 0),
    'movements_30d', coalesce((select count(*) from public.stock_movements where inventory_id = p_inventory_id and created_at >= timezone('utc', now()) - interval '30 days'), 0)
  ) into result;
  return result;
end;
$$;

create or replace function public.get_replenishment_suggestions(p_inventory_id uuid)
returns table (
  product_id uuid,
  product_name text,
  sku text,
  current_quantity numeric,
  minimum_stock numeric,
  target_stock numeric,
  suggested_quantity numeric,
  criteria text
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id,
    p.name,
    p.sku,
    coalesce(b.quantity, 0),
    coalesce(nullif(p.minimum_stock, 0), coalesce(s.global_minimum_stock, 0)),
    p.target_stock,
    greatest(0, p.target_stock - coalesce(b.quantity, 0)),
    format(
      'Saldo atual (%s) <= estoque mínimo efetivo (%s; mínimo individual ou padrão global); sugestão = max(0, estoque-alvo (%s) - saldo atual).',
      coalesce(b.quantity, 0),
      coalesce(nullif(p.minimum_stock, 0), coalesce(s.global_minimum_stock, 0)),
      p.target_stock
    )
  from public.products p
  left join public.stock_balances b on b.product_id = p.id and b.inventory_id = p_inventory_id
  left join public.inventory_settings s on s.inventory_id = p_inventory_id
  where public.is_active_user()
    and exists (select 1 from public.inventories i where i.id = p_inventory_id and i.active)
    and p.active
    and coalesce(b.quantity, 0) <= coalesce(nullif(p.minimum_stock, 0), coalesce(s.global_minimum_stock, 0))
  order by (p.target_stock - coalesce(b.quantity, 0)) desc, p.name asc;
$$;
