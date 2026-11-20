-- ESTCODE initial schema. Apply with `supabase db push` or the Supabase dashboard.
create extension if not exists pgcrypto;

create type public.user_role as enum ('admin', 'operator', 'consultant');
create type public.movement_type as enum ('entry', 'exit', 'adjustment');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role public.user_role not null default 'operator',
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint profiles_full_name_length check (char_length(full_name) <= 160)
);

create table public.inventories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  constraint inventories_name_length check (char_length(trim(name)) between 1 and 120)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint categories_name_length check (char_length(trim(name)) between 1 and 120)
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  document text,
  phone text,
  email text,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint suppliers_name_length check (char_length(trim(name)) between 1 and 160)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text,
  barcode text,
  description text,
  category_id uuid references public.categories(id) on delete set null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  unit text not null default 'un',
  minimum_stock numeric(14, 3) not null default 0,
  target_stock numeric(14, 3) not null default 0,
  cost_price numeric(14, 2),
  sale_price numeric(14, 2),
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint products_name_length check (char_length(trim(name)) between 1 and 200),
  constraint products_unit_length check (char_length(trim(unit)) between 1 and 20),
  constraint products_minimum_stock_nonnegative check (minimum_stock >= 0),
  constraint products_target_stock_valid check (target_stock >= minimum_stock),
  constraint products_cost_price_nonnegative check (cost_price is null or cost_price >= 0),
  constraint products_sale_price_nonnegative check (sale_price is null or sale_price >= 0)
);

create table public.inventory_settings (
  inventory_id uuid primary key references public.inventories(id) on delete cascade,
  allow_negative_balance boolean not null default false,
  allow_operator_adjustments boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.stock_balances (
  id uuid primary key default gen_random_uuid(),
  inventory_id uuid not null references public.inventories(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity numeric(14, 3) not null default 0,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint stock_balances_inventory_product_unique unique (inventory_id, product_id)
);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  inventory_id uuid not null references public.inventories(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  movement_type public.movement_type not null,
  quantity numeric(14, 3) not null,
  previous_balance numeric(14, 3) not null,
  resulting_balance numeric(14, 3) not null,
  counted_quantity numeric(14, 3),
  reason text not null,
  notes text,
  idempotency_key uuid not null unique,
  created_at timestamptz not null default timezone('utc', now()),
  constraint stock_movements_reason_length check (char_length(trim(reason)) between 1 and 240),
  constraint stock_movements_notes_length check (notes is null or char_length(notes) <= 2000),
  constraint stock_movements_quantity_shape check (
    (movement_type in ('entry', 'exit') and quantity > 0 and counted_quantity is null)
    or
    (movement_type = 'adjustment' and counted_quantity is not null and counted_quantity >= 0 and quantity = resulting_balance - previous_balance)
  )
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint audit_logs_action_length check (char_length(trim(action)) between 1 and 120),
  constraint audit_logs_entity_type_length check (char_length(trim(entity_type)) between 1 and 120)
);

create unique index categories_name_unique on public.categories (lower(trim(name)));
create unique index suppliers_document_unique on public.suppliers (regexp_replace(document, '[^0-9]', '', 'g'))
  where document is not null and trim(document) <> '';
create unique index products_sku_unique on public.products (lower(trim(sku)))
  where sku is not null and trim(sku) <> '';
create unique index products_barcode_unique on public.products (trim(barcode))
  where barcode is not null and trim(barcode) <> '';
create index products_name_search on public.products using gin (to_tsvector('simple', name));
create index products_category_idx on public.products (category_id) where active;
create index products_supplier_idx on public.products (supplier_id) where active;
create index stock_balances_product_idx on public.stock_balances (product_id);
create index stock_movements_inventory_created_idx on public.stock_movements (inventory_id, created_at desc);
create index stock_movements_product_created_idx on public.stock_movements (product_id, created_at desc);
create index stock_movements_user_created_idx on public.stock_movements (user_id, created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id, created_at desc);

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger categories_set_updated_at before update on public.categories
for each row execute function public.set_updated_at();
create trigger suppliers_set_updated_at before update on public.suppliers
for each row execute function public.set_updated_at();
create trigger products_set_updated_at before update on public.products
for each row execute function public.set_updated_at();
create trigger inventory_settings_set_updated_at before update on public.inventory_settings
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and active;
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and active
  );
$$;

create or replace function public.has_role(required_roles public.user_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() = any(required_roles), false);
$$;

create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- The first administrator is promoted by a trusted SQL/bootstrap context,
  -- before an authenticated admin exists. Regular user JWTs still cannot
  -- change role or active status without an existing admin profile.
  if auth.uid() is null then
    return new;
  end if;
  if old.id <> auth.uid() and not public.has_role(array['admin']::public.user_role[]) then
    raise exception 'profile_update_not_allowed' using errcode = '42501';
  end if;
  if (old.role <> new.role or old.active <> new.active)
     and not public.has_role(array['admin']::public.user_role[]) then
    raise exception 'profile_admin_fields_not_allowed' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_protect_fields before update on public.profiles
for each row execute function public.protect_profile_fields();

create or replace function public.assert_active_user(allowed_roles public.user_role[] default null)
returns public.user_role
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  actor_role public.user_role;
begin
  select role into actor_role from public.profiles where id = auth.uid() and active;
  if actor_role is null then
    raise exception 'active_user_required' using errcode = '42501';
  end if;
  if allowed_roles is not null and not actor_role = any(allowed_roles) then
    raise exception 'role_not_allowed' using errcode = '42501';
  end if;
  return actor_role;
end;
$$;

create or replace function public.get_shared_inventory_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.inventories
  where active and public.is_active_user()
  order by created_at asc
  limit 1;
$$;

create or replace function public.movement_result(
  movement public.stock_movements,
  duplicate boolean default false
)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'movement_id', movement.id,
    'inventory_id', movement.inventory_id,
    'product_id', movement.product_id,
    'movement_type', movement.movement_type,
    'quantity', movement.quantity,
    'previous_balance', movement.previous_balance,
    'resulting_balance', movement.resulting_balance,
    'counted_quantity', movement.counted_quantity,
    'reason', movement.reason,
    'notes', movement.notes,
    'created_at', movement.created_at,
    'was_duplicate', duplicate
  );
$$;

create or replace function public.register_stock_entry(
  p_inventory_id uuid,
  p_product_id uuid,
  p_quantity numeric,
  p_reason text,
  p_notes text default null,
  p_idempotency_key uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role public.user_role;
  existing_movement public.stock_movements;
  balance_row public.stock_balances;
  new_movement public.stock_movements;
begin
  actor_role := public.assert_active_user(array['admin', 'operator']::public.user_role[]);
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'quantity_must_be_positive' using errcode = '22023';
  end if;
  if p_reason is null or char_length(trim(p_reason)) = 0 then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  select * into existing_movement from public.stock_movements where idempotency_key = p_idempotency_key;
  if existing_movement.id is not null then
    if existing_movement.user_id <> auth.uid() then
      raise exception 'idempotency_key_conflict' using errcode = '23505';
    end if;
    return public.movement_result(existing_movement, true);
  end if;
  if not exists (select 1 from public.inventories where id = p_inventory_id and active) then
    raise exception 'inventory_not_found' using errcode = '22023';
  end if;
  if not exists (select 1 from public.products where id = p_product_id and active) then
    raise exception 'product_not_found' using errcode = '22023';
  end if;
  insert into public.stock_balances (inventory_id, product_id, quantity)
  values (p_inventory_id, p_product_id, 0)
  on conflict (inventory_id, product_id) do nothing;
  select * into balance_row from public.stock_balances
  where inventory_id = p_inventory_id and product_id = p_product_id for update;
  update public.stock_balances
  set quantity = balance_row.quantity + p_quantity, updated_at = timezone('utc', now())
  where id = balance_row.id;
  insert into public.stock_movements (
    inventory_id, product_id, user_id, movement_type, quantity,
    previous_balance, resulting_balance, reason, notes, idempotency_key
  ) values (
    p_inventory_id, p_product_id, auth.uid(), 'entry', p_quantity,
    balance_row.quantity, balance_row.quantity + p_quantity, trim(p_reason), p_notes, p_idempotency_key
  ) returning * into new_movement;
  insert into public.audit_logs (user_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'stock_entry', 'stock_movements', new_movement.id,
    jsonb_build_object('product_id', p_product_id, 'quantity', p_quantity));
  return public.movement_result(new_movement, false);
end;
$$;

create or replace function public.register_stock_exit(
  p_inventory_id uuid,
  p_product_id uuid,
  p_quantity numeric,
  p_reason text,
  p_notes text default null,
  p_idempotency_key uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role public.user_role;
  existing_movement public.stock_movements;
  balance_row public.stock_balances;
  settings_row public.inventory_settings;
  new_movement public.stock_movements;
  resulting numeric;
begin
  actor_role := public.assert_active_user(array['admin', 'operator']::public.user_role[]);
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'quantity_must_be_positive' using errcode = '22023';
  end if;
  if p_reason is null or char_length(trim(p_reason)) = 0 then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  select * into existing_movement from public.stock_movements where idempotency_key = p_idempotency_key;
  if existing_movement.id is not null then
    if existing_movement.user_id <> auth.uid() then
      raise exception 'idempotency_key_conflict' using errcode = '23505';
    end if;
    return public.movement_result(existing_movement, true);
  end if;
  select * into settings_row from public.inventory_settings where inventory_id = p_inventory_id;
  if settings_row.inventory_id is null then
    raise exception 'inventory_settings_not_found' using errcode = '22023';
  end if;
  if not exists (select 1 from public.inventories where id = p_inventory_id and active) then
    raise exception 'inventory_not_found' using errcode = '22023';
  end if;
  if not exists (select 1 from public.products where id = p_product_id and active) then
    raise exception 'product_not_found' using errcode = '22023';
  end if;
  insert into public.stock_balances (inventory_id, product_id, quantity)
  values (p_inventory_id, p_product_id, 0)
  on conflict (inventory_id, product_id) do nothing;
  select * into balance_row from public.stock_balances
  where inventory_id = p_inventory_id and product_id = p_product_id for update;
  resulting := balance_row.quantity - p_quantity;
  if resulting < 0 and not settings_row.allow_negative_balance then
    raise exception 'insufficient_stock' using errcode = '23514';
  end if;
  update public.stock_balances
  set quantity = resulting, updated_at = timezone('utc', now())
  where id = balance_row.id;
  insert into public.stock_movements (
    inventory_id, product_id, user_id, movement_type, quantity,
    previous_balance, resulting_balance, reason, notes, idempotency_key
  ) values (
    p_inventory_id, p_product_id, auth.uid(), 'exit', p_quantity,
    balance_row.quantity, resulting, trim(p_reason), p_notes, p_idempotency_key
  ) returning * into new_movement;
  insert into public.audit_logs (user_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'stock_exit', 'stock_movements', new_movement.id,
    jsonb_build_object('product_id', p_product_id, 'quantity', p_quantity));
  return public.movement_result(new_movement, false);
end;
$$;

create or replace function public.register_stock_adjustment(
  p_inventory_id uuid,
  p_product_id uuid,
  p_counted_quantity numeric,
  p_reason text,
  p_notes text default null,
  p_idempotency_key uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role public.user_role;
  existing_movement public.stock_movements;
  balance_row public.stock_balances;
  settings_row public.inventory_settings;
  new_movement public.stock_movements;
  delta numeric;
begin
  actor_role := public.assert_active_user(array['admin', 'operator']::public.user_role[]);
  if p_counted_quantity is null or p_counted_quantity < 0 then
    raise exception 'counted_quantity_invalid' using errcode = '22023';
  end if;
  if p_reason is null or char_length(trim(p_reason)) = 0 then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  select * into existing_movement from public.stock_movements where idempotency_key = p_idempotency_key;
  if existing_movement.id is not null then
    if existing_movement.user_id <> auth.uid() then
      raise exception 'idempotency_key_conflict' using errcode = '23505';
    end if;
    return public.movement_result(existing_movement, true);
  end if;
  select * into settings_row from public.inventory_settings where inventory_id = p_inventory_id;
  if settings_row.inventory_id is null then
    raise exception 'inventory_settings_not_found' using errcode = '22023';
  end if;
  if actor_role = 'operator' and not settings_row.allow_operator_adjustments then
    raise exception 'adjustment_not_allowed' using errcode = '42501';
  end if;
  if not exists (select 1 from public.inventories where id = p_inventory_id and active) then
    raise exception 'inventory_not_found' using errcode = '22023';
  end if;
  if not exists (select 1 from public.products where id = p_product_id and active) then
    raise exception 'product_not_found' using errcode = '22023';
  end if;
  insert into public.stock_balances (inventory_id, product_id, quantity)
  values (p_inventory_id, p_product_id, 0)
  on conflict (inventory_id, product_id) do nothing;
  select * into balance_row from public.stock_balances
  where inventory_id = p_inventory_id and product_id = p_product_id for update;
  delta := p_counted_quantity - balance_row.quantity;
  update public.stock_balances
  set quantity = p_counted_quantity, updated_at = timezone('utc', now())
  where id = balance_row.id;
  insert into public.stock_movements (
    inventory_id, product_id, user_id, movement_type, quantity,
    previous_balance, resulting_balance, counted_quantity, reason, notes, idempotency_key
  ) values (
    p_inventory_id, p_product_id, auth.uid(), 'adjustment', delta,
    balance_row.quantity, p_counted_quantity, p_counted_quantity, trim(p_reason), p_notes, p_idempotency_key
  ) returning * into new_movement;
  insert into public.audit_logs (user_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'stock_adjustment', 'stock_movements', new_movement.id,
    jsonb_build_object('product_id', p_product_id, 'counted_quantity', p_counted_quantity, 'delta', delta));
  return public.movement_result(new_movement, false);
end;
$$;

create or replace function public.get_inventory_dashboard(p_inventory_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  perform public.assert_active_user();
  if not exists (select 1 from public.inventories where id = p_inventory_id and active) then
    raise exception 'inventory_not_found' using errcode = '22023';
  end if;
  select jsonb_build_object(
    'total_products', (select count(*) from public.products where active),
    'total_quantity', coalesce((select sum(quantity) from public.stock_balances where inventory_id = p_inventory_id), 0),
    'below_minimum', coalesce((
      select count(*) from public.products p
      left join public.stock_balances b on b.product_id = p.id and b.inventory_id = p_inventory_id
      where p.active and coalesce(b.quantity, 0) <= p.minimum_stock
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
  select p.id, p.name, p.sku, coalesce(b.quantity, 0), p.minimum_stock, p.target_stock,
    greatest(0, p.target_stock - coalesce(b.quantity, 0)),
    format('Saldo atual (%s) <= estoque mínimo (%s); sugestão = max(0, estoque-alvo (%s) - saldo atual).', coalesce(b.quantity, 0), p.minimum_stock, p.target_stock)
  from public.products p
  left join public.stock_balances b on b.product_id = p.id and b.inventory_id = p_inventory_id
  where public.is_active_user()
    and exists (select 1 from public.inventories i where i.id = p_inventory_id and i.active)
    and p.active and coalesce(b.quantity, 0) <= p.minimum_stock
  order by (p.target_stock - coalesce(b.quantity, 0)) desc, p.name asc;
$$;

create or replace function public.get_inventory_insights(p_inventory_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  perform public.assert_active_user();
  if not exists (select 1 from public.inventories where id = p_inventory_id and active) then
    raise exception 'inventory_not_found' using errcode = '22023';
  end if;
  with active_products as (
    select p.id, p.name, p.sku
    from public.products p where p.active
  ),
  no_movement as (
    select ap.id, ap.name, ap.sku
    from active_products ap
    where not exists (select 1 from public.stock_movements m where m.inventory_id = p_inventory_id and m.product_id = ap.id)
  ),
  top_exit as (
    select p.id, p.name, p.sku, sum(m.quantity) as quantity
    from public.stock_movements m join public.products p on p.id = m.product_id
    where m.inventory_id = p_inventory_id and m.movement_type = 'exit' and m.created_at >= timezone('utc', now()) - interval '30 days'
    group by p.id, p.name, p.sku order by quantity desc limit 10
  ),
  consumption_history as (
    select (m.created_at at time zone 'UTC')::date as consumption_date, sum(m.quantity) as quantity
    from public.stock_movements m
    where m.inventory_id = p_inventory_id
      and m.movement_type = 'exit'
      and m.created_at >= timezone('utc', now()) - interval '30 days'
    group by 1
    order by consumption_date asc
  )
  select jsonb_build_object(
    'no_movement', coalesce((select jsonb_agg(to_jsonb(no_movement)) from no_movement), '[]'::jsonb),
    'top_exits_30d', coalesce((select jsonb_agg(to_jsonb(top_exit)) from top_exit), '[]'::jsonb),
    'consumption_history', coalesce((select jsonb_agg(jsonb_build_object('date', consumption_date, 'quantity', quantity) order by consumption_date) from consumption_history), '[]'::jsonb),
    'criteria', jsonb_build_object(
      'no_movement', 'Produto ativo sem qualquer movimentação registrada.',
      'top_exits_30d', 'Quantidade total de saídas nos últimos 30 dias; usado como indicador transparente de giro.',
      'consumption_history', 'Quantidade de saídas agrupada por dia nos últimos 30 dias; não é uma previsão.'
    )
  ) into result;
  return result;
end;
$$;

alter table public.profiles enable row level security;
alter table public.inventories enable row level security;
alter table public.categories enable row level security;
alter table public.suppliers enable row level security;
alter table public.products enable row level security;
alter table public.inventory_settings enable row level security;
alter table public.stock_balances enable row level security;
alter table public.stock_movements enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_select_self_or_admin on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_role(array['admin']::public.user_role[]));
create policy profiles_update_self_or_admin on public.profiles for update to authenticated
  using (id = auth.uid() or public.has_role(array['admin']::public.user_role[]))
  with check (id = auth.uid() or public.has_role(array['admin']::public.user_role[]));

create policy inventories_select_active_users on public.inventories for select to authenticated
  using (public.is_active_user());
create policy inventories_admin_update on public.inventories for update to authenticated
  using (public.has_role(array['admin']::public.user_role[]))
  with check (public.has_role(array['admin']::public.user_role[]));

create policy categories_select_active_users on public.categories for select to authenticated
  using (public.is_active_user());
create policy categories_admin_insert on public.categories for insert to authenticated
  with check (public.has_role(array['admin']::public.user_role[]));
create policy categories_admin_update on public.categories for update to authenticated
  using (public.has_role(array['admin']::public.user_role[]))
  with check (public.has_role(array['admin']::public.user_role[]));

create policy suppliers_select_active_users on public.suppliers for select to authenticated
  using (public.is_active_user());
create policy suppliers_admin_insert on public.suppliers for insert to authenticated
  with check (public.has_role(array['admin']::public.user_role[]));
create policy suppliers_admin_update on public.suppliers for update to authenticated
  using (public.has_role(array['admin']::public.user_role[]))
  with check (public.has_role(array['admin']::public.user_role[]));

create policy products_select_active_users on public.products for select to authenticated
  using (public.is_active_user());
create policy products_admin_insert on public.products for insert to authenticated
  with check (public.has_role(array['admin']::public.user_role[]));
create policy products_admin_update on public.products for update to authenticated
  using (public.has_role(array['admin']::public.user_role[]))
  with check (public.has_role(array['admin']::public.user_role[]));

create policy inventory_settings_select_active_users on public.inventory_settings for select to authenticated
  using (public.is_active_user());
create policy inventory_settings_admin_update on public.inventory_settings for update to authenticated
  using (public.has_role(array['admin']::public.user_role[]))
  with check (public.has_role(array['admin']::public.user_role[]));

revoke all on table public.stock_balances from anon, authenticated;
grant select on table public.stock_balances to authenticated;
create policy stock_balances_select_active_users on public.stock_balances for select to authenticated
  using (public.is_active_user());

create policy stock_movements_select_active_users on public.stock_movements for select to authenticated
  using (public.is_active_user());
create policy audit_logs_admin_select on public.audit_logs for select to authenticated
  using (public.has_role(array['admin']::public.user_role[]));

revoke all on table public.profiles, public.inventories, public.categories, public.suppliers,
  public.products, public.inventory_settings, public.stock_movements, public.audit_logs from anon;
grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;
grant select, update on public.inventories to authenticated;
grant select, insert, update on public.categories, public.suppliers, public.products to authenticated;
grant select, update on public.inventory_settings to authenticated;
grant select on public.stock_movements, public.audit_logs to authenticated;
revoke execute on function public.set_updated_at() from public, anon;
revoke execute on function public.handle_new_user() from public, anon;
revoke execute on function public.protect_profile_fields() from public, anon;
revoke execute on function public.movement_result(public.stock_movements, boolean) from public, anon;
revoke execute on function public.current_user_role() from public, anon;
revoke execute on function public.is_active_user() from public, anon;
revoke execute on function public.has_role(public.user_role[]) from public, anon;
revoke execute on function public.assert_active_user(public.user_role[]) from public, anon;
revoke execute on function public.register_stock_entry(uuid, uuid, numeric, text, text, uuid) from public, anon;
revoke execute on function public.register_stock_exit(uuid, uuid, numeric, text, text, uuid) from public, anon;
revoke execute on function public.register_stock_adjustment(uuid, uuid, numeric, text, text, uuid) from public, anon;
revoke execute on function public.get_inventory_dashboard(uuid) from public, anon;
revoke execute on function public.get_replenishment_suggestions(uuid) from public, anon;
revoke execute on function public.get_inventory_insights(uuid) from public, anon;
revoke execute on function public.get_shared_inventory_id() from public, anon;
grant execute on function public.register_stock_entry(uuid, uuid, numeric, text, text, uuid) to authenticated;
grant execute on function public.register_stock_exit(uuid, uuid, numeric, text, text, uuid) to authenticated;
grant execute on function public.register_stock_adjustment(uuid, uuid, numeric, text, text, uuid) to authenticated;
grant execute on function public.get_inventory_dashboard(uuid) to authenticated;
grant execute on function public.get_replenishment_suggestions(uuid) to authenticated;
grant execute on function public.get_inventory_insights(uuid) to authenticated;
grant execute on function public.get_shared_inventory_id() to authenticated;
