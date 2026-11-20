create table public.fiscal_company_settings (
  singleton boolean primary key default true check (singleton),
  cnpj text not null,
  last_nsu text not null default '000000000000000' check (last_nsu ~ '^\d{15}$'),
  max_nsu text not null default '000000000000000' check (max_nsu ~ '^\d{15}$'),
  last_consulted_at timestamptz,
  next_allowed_at timestamptz,
  sync_lease_id uuid,
  sync_lease_expires_at timestamptz,
  updated_at timestamptz not null default now()
);

create or replace function public.is_valid_cnpj(value text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  digits text := regexp_replace(value, '[^0-9]', '', 'g');
  weights_first integer[] := array[5,4,3,2,9,8,7,6,5,4,3,2];
  weights_second integer[] := array[6,5,4,3,2,9,8,7,6,5,4,3,2];
  sum_first integer := 0;
  sum_second integer := 0;
  remainder integer;
  expected_first integer;
  expected_second integer;
  i integer;
begin
  if length(digits) <> 14 or digits ~ '^([0-9])\1{13}$' then return false; end if;
  for i in 1..12 loop sum_first := sum_first + substring(digits from i for 1)::integer * weights_first[i]; end loop;
  remainder := sum_first % 11;
  expected_first := case when remainder < 2 then 0 else 11 - remainder end;
  for i in 1..13 loop sum_second := sum_second + substring(digits from i for 1)::integer * weights_second[i]; end loop;
  remainder := sum_second % 11;
  expected_second := case when remainder < 2 then 0 else 11 - remainder end;
  return substring(digits from 13 for 1)::integer = expected_first
    and substring(digits from 14 for 1)::integer = expected_second;
end;
$$;

alter table public.fiscal_company_settings
  add constraint fiscal_company_settings_cnpj_check check (public.is_valid_cnpj(cnpj));
revoke all on function public.is_valid_cnpj(text) from public, anon;
grant execute on function public.is_valid_cnpj(text) to authenticated;

create table public.incoming_fiscal_documents (
  id uuid primary key default gen_random_uuid(),
  nsu text not null unique check (nsu ~ '^\d{1,15}$'),
  access_key text unique check (access_key is null or access_key ~ '^\d{44}$'),
  schema text not null,
  document_type text not null check (document_type in ('summary','full','event','unknown')),
  issuer_cnpj text,
  issuer_name text,
  issued_at timestamptz,
  total_amount numeric(14,2) check (total_amount is null or total_amount >= 0),
  fiscal_status text not null default 'awaiting_review'
    check (fiscal_status in ('awaiting_manifestation','ready_for_review','applied','canceled','ignored')),
  xml_path text not null unique,
  metadata jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  applied_at timestamptz,
  applied_by uuid references public.profiles(id) on delete restrict,
  constraint incoming_fiscal_documents_path_matches_id check (xml_path = id::text || '.xml')
);

create table public.incoming_fiscal_document_items (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.incoming_fiscal_documents(id) on delete restrict,
  line_number integer not null check (line_number > 0),
  supplier_code text,
  barcode text,
  description text not null check (char_length(trim(description)) between 1 and 500),
  unit text,
  quantity numeric(14,4) not null check (quantity > 0),
  unit_price numeric(14,4) not null check (unit_price >= 0),
  product_id uuid references public.products(id) on delete restrict,
  mapped_by uuid references public.profiles(id) on delete restrict,
  mapped_at timestamptz,
  unique (document_id, line_number)
);

alter table public.stock_movements add column source_fiscal_item_id uuid
  references public.incoming_fiscal_document_items(id) on delete restrict;
create unique index stock_movements_fiscal_item_unique
  on public.stock_movements (source_fiscal_item_id) where source_fiscal_item_id is not null;

alter table public.fiscal_company_settings enable row level security;
alter table public.incoming_fiscal_documents enable row level security;
alter table public.incoming_fiscal_document_items enable row level security;

create policy fiscal_company_settings_admin_select on public.fiscal_company_settings
  for select to authenticated using (public.has_role(array['admin']::public.user_role[]));
create policy fiscal_company_settings_admin_insert on public.fiscal_company_settings
  for insert to authenticated with check (public.has_role(array['admin']::public.user_role[]));
create policy fiscal_company_settings_admin_update on public.fiscal_company_settings
  for update to authenticated using (public.has_role(array['admin']::public.user_role[]))
  with check (public.has_role(array['admin']::public.user_role[]));
create policy fiscal_documents_active_select on public.incoming_fiscal_documents
  for select to authenticated using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.active));
create policy fiscal_documents_admin_insert on public.incoming_fiscal_documents
  for insert to authenticated with check (public.has_role(array['admin']::public.user_role[]));
create policy fiscal_documents_admin_update on public.incoming_fiscal_documents
  for update to authenticated using (public.has_role(array['admin']::public.user_role[]))
  with check (public.has_role(array['admin']::public.user_role[]));
create policy fiscal_document_items_active_select on public.incoming_fiscal_document_items
  for select to authenticated using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.active));
create policy fiscal_document_items_admin_insert on public.incoming_fiscal_document_items
  for insert to authenticated with check (public.has_role(array['admin']::public.user_role[]));
create policy fiscal_document_items_admin_update on public.incoming_fiscal_document_items
  for update to authenticated using (public.has_role(array['admin']::public.user_role[]))
  with check (public.has_role(array['admin']::public.user_role[]));

revoke all on public.fiscal_company_settings, public.incoming_fiscal_documents,
  public.incoming_fiscal_document_items from anon;
grant select, insert, update on public.fiscal_company_settings to authenticated;
grant select, insert, update on public.incoming_fiscal_documents to authenticated;
grant select, insert, update on public.incoming_fiscal_document_items to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('incoming-fiscal-xml', 'incoming-fiscal-xml', false, 8388608, array['application/xml','text/xml'])
on conflict (id) do update set public = false, file_size_limit = 8388608,
  allowed_mime_types = array['application/xml','text/xml'];

create policy incoming_xml_active_select on storage.objects for select to authenticated
  using (bucket_id = 'incoming-fiscal-xml' and exists (
    select 1 from public.profiles p where p.id = (select auth.uid()) and p.active
  ));
create policy incoming_xml_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'incoming-fiscal-xml' and public.has_role(array['admin']::public.user_role[]));
create policy incoming_xml_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'incoming-fiscal-xml' and public.has_role(array['admin']::public.user_role[]))
  with check (bucket_id = 'incoming-fiscal-xml' and public.has_role(array['admin']::public.user_role[]));

create index incoming_fiscal_documents_received_idx on public.incoming_fiscal_documents (received_at desc);
create index incoming_fiscal_documents_issuer_idx on public.incoming_fiscal_documents (issuer_cnpj, issued_at desc);
create index incoming_fiscal_items_product_idx on public.incoming_fiscal_document_items (product_id) where product_id is not null;

create or replace function public.acquire_fiscal_sync_lease(p_lease_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  settings public.fiscal_company_settings;
begin
  if not public.has_role(array['admin']::public.user_role[]) then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  select * into settings from public.fiscal_company_settings where singleton for update;
  if not found then return false; end if;
  if settings.next_allowed_at is not null and settings.next_allowed_at > now() then return false; end if;
  if settings.sync_lease_expires_at is not null and settings.sync_lease_expires_at > now() then return false; end if;
  update public.fiscal_company_settings
    set sync_lease_id = p_lease_id, sync_lease_expires_at = now() + interval '2 minutes'
    where singleton;
  return true;
end;
$$;

create or replace function public.release_fiscal_sync_lease(p_lease_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role(array['admin']::public.user_role[]) then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  update public.fiscal_company_settings
    set sync_lease_id = null, sync_lease_expires_at = null
    where singleton and sync_lease_id = p_lease_id;
end;
$$;

revoke all on function public.acquire_fiscal_sync_lease(uuid) from public, anon;
revoke all on function public.release_fiscal_sync_lease(uuid) from public, anon;
grant execute on function public.acquire_fiscal_sync_lease(uuid) to authenticated;
grant execute on function public.release_fiscal_sync_lease(uuid) to authenticated;

create or replace function public.apply_incoming_fiscal_document(p_document_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  document_row public.incoming_fiscal_documents;
  invoice_item record;
  balance_row public.stock_balances;
  v_inventory_id uuid;
  movement_id uuid;
  applied_items jsonb := '[]'::jsonb;
begin
  perform public.assert_active_user(array['admin']::public.user_role[]);
  select * into document_row from public.incoming_fiscal_documents
    where id = p_document_id for update;
  if not found then raise exception 'fiscal_document_not_found' using errcode = '22023'; end if;
  if document_row.fiscal_status = 'applied' then
    return jsonb_build_object('already_applied', true, 'document_id', p_document_id);
  end if;
  if document_row.fiscal_status <> 'ready_for_review' or document_row.document_type <> 'full' then
    raise exception 'fiscal_document_not_ready' using errcode = '22023';
  end if;
  if not exists (select 1 from public.incoming_fiscal_document_items where document_id = p_document_id) then
    raise exception 'fiscal_document_has_no_items' using errcode = '22023';
  end if;
  if exists (select 1 from public.incoming_fiscal_document_items where document_id = p_document_id and product_id is null) then
    raise exception 'fiscal_items_require_product_mapping' using errcode = '22023';
  end if;
  v_inventory_id := public.get_shared_inventory_id();
  if v_inventory_id is null then raise exception 'shared_inventory_not_found' using errcode = '22023'; end if;

  for invoice_item in
    select i.*, p.unit as product_unit, p.active as product_active
    from public.incoming_fiscal_document_items i
    join public.products p on p.id = i.product_id
    where i.document_id = p_document_id order by i.line_number for update of i, p
  loop
    if not invoice_item.product_active then raise exception 'fiscal_product_inactive' using errcode = '22023'; end if;
    if invoice_item.unit is null or lower(trim(invoice_item.unit)) <> lower(trim(invoice_item.product_unit)) then
      raise exception 'fiscal_product_unit_mismatch' using errcode = '22023';
    end if;
    if invoice_item.quantity > 99999999999.999 or invoice_item.quantity <> round(invoice_item.quantity, 3) then
      raise exception 'fiscal_quantity_precision_unsupported' using errcode = '22023';
    end if;
    insert into public.stock_balances (inventory_id, product_id, quantity)
      values (v_inventory_id, invoice_item.product_id, 0)
      on conflict (inventory_id, product_id) do nothing;
    select * into balance_row from public.stock_balances
      where stock_balances.inventory_id = v_inventory_id
        and stock_balances.product_id = invoice_item.product_id for update;
    update public.stock_balances set quantity = balance_row.quantity + invoice_item.quantity,
      updated_at = timezone('utc', now()) where id = balance_row.id;
    insert into public.stock_movements (
      inventory_id, product_id, user_id, movement_type, quantity, previous_balance,
      resulting_balance, reason, notes, idempotency_key, source_fiscal_item_id
    ) values (
      v_inventory_id, invoice_item.product_id, auth.uid(), 'entry', invoice_item.quantity,
      balance_row.quantity, balance_row.quantity + invoice_item.quantity,
      'Entrada por nota fiscal', 'Chave NF-e: ' || coalesce(document_row.access_key, 'indisponível') || '; linha ' || invoice_item.line_number,
      md5(p_document_id::text || ':' || invoice_item.id::text)::uuid, invoice_item.id
    ) returning id into movement_id;
    applied_items := applied_items || jsonb_build_array(jsonb_build_object(
      'item_id', invoice_item.id, 'movement_id', movement_id,
      'product_id', invoice_item.product_id, 'resulting_balance', balance_row.quantity + invoice_item.quantity
    ));
  end loop;

  update public.incoming_fiscal_documents set fiscal_status = 'applied', applied_at = now(), applied_by = auth.uid()
    where id = p_document_id;
  insert into public.audit_logs (user_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'fiscal_document_applied', 'incoming_fiscal_documents', p_document_id,
      jsonb_build_object('access_key', document_row.access_key, 'items', jsonb_array_length(applied_items)));
  return jsonb_build_object('already_applied', false, 'document_id', p_document_id, 'items', applied_items);
end;
$$;

revoke all on function public.apply_incoming_fiscal_document(uuid) from public, anon;
grant execute on function public.apply_incoming_fiscal_document(uuid) to authenticated;
