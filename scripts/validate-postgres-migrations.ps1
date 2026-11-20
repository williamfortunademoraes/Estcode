[CmdletBinding()]
param(
  [int]$Port = 55432
)

$ErrorActionPreference = 'Stop'
$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$migrationDirectory = Join-Path $workspaceRoot 'supabase\migrations'
$clusterPath = Join-Path ([System.IO.Path]::GetTempPath()) ("estcode-migration-" + [guid]::NewGuid().ToString('N'))
$initdb = 'C:\Program Files\PostgreSQL\16\bin\initdb.exe'
$pgctl = 'C:\Program Files\PostgreSQL\16\bin\pg_ctl.exe'
$psql = 'C:\Program Files\PostgreSQL\16\bin\psql.exe'
$serverStarted = $false

foreach ($executable in @($initdb, $pgctl, $psql)) {
  if (-not (Test-Path -LiteralPath $executable -PathType Leaf)) {
    throw "PostgreSQL executable not found: $executable"
  }
}

function Invoke-ValidationSql {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Sql
  )

  Write-Host 'Executing validation SQL...'
  & $psql -h 127.0.0.1 -p $Port -U postgres -d postgres -v ON_ERROR_STOP=1 -c $Sql
  if ($LASTEXITCODE -ne 0) {
    throw 'PostgreSQL validation SQL failed.'
  }
}

try {
  & $initdb -D $clusterPath -U postgres -A trust --no-locale --encoding=UTF8
  if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL cluster initialization failed.' }

  & $pgctl -D $clusterPath -o "-p $Port -h 127.0.0.1" -w start
  if ($LASTEXITCODE -ne 0) { throw 'Temporary PostgreSQL server failed to start.' }
  $serverStarted = $true

  $bootstrapSql = @'
create role anon;
create role authenticated;
create role service_role;
create schema auth;
create schema storage;
create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text not null
);
create or replace function storage.foldername(object_name text)
returns text[]
language sql
immutable
as $function$
  select (string_to_array(object_name, '/'))[1:array_length(string_to_array(object_name, '/'), 1) - 1];
$function$;
create table auth.users (
  id uuid primary key,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);
create or replace function auth.uid()
returns uuid
language sql
stable
as $function$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$function$;
create publication supabase_realtime;
'@
  Write-Host 'Bootstrapping Supabase compatibility objects...'
  Invoke-ValidationSql -Sql $bootstrapSql
  Write-Host 'Bootstrap complete.'

  foreach ($migration in (Get-ChildItem -LiteralPath $migrationDirectory -Filter '*.sql' | Sort-Object Name)) {
    Write-Host "Applying $($migration.Name)..."
    & $psql -h 127.0.0.1 -p $Port -U postgres -d postgres -v ON_ERROR_STOP=1 -f $migration.FullName
    if ($LASTEXITCODE -ne 0) { throw "Migration failed: $($migration.Name)" }
  }

  $fixtureSql = @'
insert into auth.users (id, raw_user_meta_data)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '{"full_name":"Admin Teste"}'::jsonb);
update public.profiles
set role = 'admin'
where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
insert into public.products (id, name, sku, unit, minimum_stock, target_stock)
values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Produto de teste', 'TEST-001', 'un', 1, 10);
insert into public.fiscal_company_settings (singleton, cnpj)
values (true, '11222333000181');
insert into public.incoming_fiscal_documents (
  id, nsu, access_key, schema, document_type, issuer_name, total_amount,
  fiscal_status, xml_path
) values (
  '22222222-2222-4222-8222-222222222222', '000000000000001',
  '35261112345678000199550010000000011000000010', 'procNFe_v4.00.xsd', 'full',
  'Fornecedor Teste', 25, 'ready_for_review',
  '22222222-2222-4222-8222-222222222222.xml'
);
insert into public.incoming_fiscal_document_items (
  id, document_id, line_number, supplier_code, description, unit, quantity, unit_price, product_id
) values (
  '33333333-3333-4333-8333-333333333333', '22222222-2222-4222-8222-222222222222',
  1, 'TEST-001', 'Produto de teste', 'un', 2, 12.5, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
);
'@
  Invoke-ValidationSql -Sql $fixtureSql

  $validationSql = @'
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', false);
do $validation$
declare
  result jsonb;
  inventory_id uuid := '00000000-0000-0000-0000-000000000001';
  product_id uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  idempotency_key uuid := 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  fiscal_lease_id uuid := '12121212-1212-4212-8212-121212121212';
begin
  if public.get_shared_inventory_id() <> inventory_id then
    raise exception 'shared inventory lookup failed';
  end if;

  result := public.register_stock_entry(inventory_id, product_id, 5, 'Entrada inicial', null, idempotency_key);
  if (result ->> 'resulting_balance')::numeric <> 5 then
    raise exception 'entry balance assertion failed';
  end if;

  result := public.register_stock_entry(inventory_id, product_id, 5, 'Entrada inicial', null, idempotency_key);
  if coalesce((result ->> 'was_duplicate')::boolean, false) is not true then
    raise exception 'idempotency assertion failed';
  end if;

  begin
    perform public.register_stock_exit(inventory_id, product_id, 6, 'Saida excessiva', null, 'dddddddd-dddd-4ddd-8ddd-dddddddddddd');
    raise exception 'negative balance was not blocked';
  exception when others then
    if position('insufficient_stock' in sqlerrm) = 0 then
      raise;
    end if;
  end;

  result := public.register_stock_exit(inventory_id, product_id, 2, 'Saida valida', null, 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
  if (result ->> 'resulting_balance')::numeric <> 3 then
    raise exception 'exit balance assertion failed';
  end if;

  result := public.register_stock_adjustment(inventory_id, product_id, 10, 'Contagem fisica', null, 'ffffffff-ffff-4fff-8fff-ffffffffffff');
  if (result ->> 'resulting_balance')::numeric <> 10 or (result ->> 'quantity')::numeric <> 7 then
    raise exception 'adjustment assertion failed';
  end if;

  if has_table_privilege('authenticated', 'public.stock_balances', 'UPDATE') then
    raise exception 'authenticated role can update stock_balances directly';
  end if;

  result := public.apply_incoming_fiscal_document('22222222-2222-4222-8222-222222222222');
  if coalesce((result ->> 'already_applied')::boolean, true) then
    raise exception 'fiscal invoice first application assertion failed';
  end if;
  result := public.apply_incoming_fiscal_document('22222222-2222-4222-8222-222222222222');
  if coalesce((result ->> 'already_applied')::boolean, false) is not true then
    raise exception 'fiscal invoice idempotency assertion failed';
  end if;
  if not public.is_valid_cnpj('11222333000181') or public.is_valid_cnpj('11222333000182') then
    raise exception 'CNPJ check-digit validation failed';
  end if;

  if not public.is_active_user() or not public.has_role(array['admin']::public.user_role[]) then
    raise exception 'RLS helper execution or role assertion failed';
  end if;
  if not public.acquire_fiscal_sync_lease(fiscal_lease_id) then
    raise exception 'fiscal sync lease acquisition failed';
  end if;
  if public.acquire_fiscal_sync_lease('13131313-1313-4313-8313-131313131313') then
    raise exception 'concurrent fiscal sync lease was not blocked';
  end if;
  perform public.release_fiscal_sync_lease(fiscal_lease_id);
  if (select quantity from public.stock_balances where public.stock_balances.inventory_id = '00000000-0000-0000-0000-000000000001' and public.stock_balances.product_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') <> 12 then
    raise exception 'authenticated RLS balance read assertion failed';
  end if;

end;
$validation$;
reset role;
do $admin_guard$
begin
  begin
    update public.profiles
    set role = 'consultant'
    where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    raise exception 'admin self-demotion was not blocked';
  exception when others then
    if position('admin_self_access_protection' in sqlerrm) = 0 then
      raise;
    end if;
  end;
end;
$admin_guard$;
select set_config('request.jwt.claim.sub', '', false);
update public.profiles
set role = 'consultant'
where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', false);
do $authorization$
begin
  begin
    perform public.register_stock_entry(
      '00000000-0000-0000-0000-000000000001',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      1,
      'Tentativa consultant',
      null,
      '11111111-1111-4111-8111-111111111111'
    );
    raise exception 'consultant mutation was not blocked';
  exception when others then
    if position('role_not_allowed' in sqlerrm) = 0 then
      raise;
    end if;
  end;
end;
$authorization$;
'@
  Invoke-ValidationSql -Sql $validationSql
  Write-Host 'PostgreSQL migration and critical RPC validation passed.'
} finally {
  if ($serverStarted) {
    & $pgctl -D $clusterPath -m fast stop
  }
  if (Test-Path -LiteralPath $clusterPath) {
    Remove-Item -LiteralPath $clusterPath -Recurse -Force
  }
}
