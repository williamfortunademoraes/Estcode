import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migration = readFileSync(join(process.cwd(), 'supabase', 'migrations', '0001_initial_schema.sql'), 'utf8');
const profileMigration = readFileSync(join(process.cwd(), 'supabase', 'migrations', '0002_profile_visibility.sql'), 'utf8');
const realtimeMigration = readFileSync(join(process.cwd(), 'supabase', 'migrations', '0003_realtime.sql'), 'utf8');
const adminProtectionMigration = readFileSync(join(process.cwd(), 'supabase', 'migrations', '0005_protect_admin_self_access.sql'), 'utf8');
const hardeningMigration = readFileSync(join(process.cwd(), 'supabase', 'migrations', '0006_security_and_performance_hardening.sql'), 'utf8');
const internalFunctionMigration = readFileSync(join(process.cwd(), 'supabase', 'migrations', '0007_revoke_internal_function_execute.sql'), 'utf8');

describe('database security contract', () => {
  it('enables RLS for every exposed domain table', () => {
    for (const table of ['profiles', 'inventories', 'categories', 'suppliers', 'products', 'inventory_settings', 'stock_balances', 'stock_movements', 'audit_logs']) {
      expect(migration).toMatch(new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
    }
    expect(profileMigration).toMatch(/profiles_select_active_users/i);
  });

  it('does not grant direct balance mutation and publishes only read-safe stock events', () => {
    expect(migration).toMatch(/revoke all on table public\.stock_balances from anon, authenticated/i);
    expect(migration).toMatch(/grant select on table public\.stock_balances to authenticated/i);
    expect(migration).not.toMatch(/grant (?:insert|update|delete)[^;]*stock_balances/i);
    expect(realtimeMigration).toMatch(/stock_balances/i);
    expect(realtimeMigration).toMatch(/stock_movements/i);
  });

  it('does not expose RPC execution to anonymous callers', () => {
    expect(migration).toMatch(/revoke execute on function public\.register_stock_entry[\s\S]*from public, anon/i);
    expect(migration).toMatch(/revoke execute on function public\.register_stock_exit[\s\S]*from public, anon/i);
    expect(migration).toMatch(/revoke execute on function public\.register_stock_adjustment[\s\S]*from public, anon/i);
    expect(migration).toMatch(/grant execute on function public\.register_stock_entry[\s\S]*to authenticated/i);
    expect(migration).toMatch(/revoke execute on function public\.handle_new_user\(\)/i);
    expect(migration).toMatch(/revoke execute on function public\.movement_result/i);
  });

  it('keeps all stock mutation paths transactional and idempotent', () => {
    expect(migration.match(/security definer/g)?.length ?? 0).toBeGreaterThan(5);
    expect(migration.match(/for update/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(migration).toMatch(/stock_movements_idempotency_key_unique|idempotency_key uuid not null unique/i);
    expect(migration).toMatch(/insert into public\.audit_logs/i);
  });

  it('guards security-definer analytics with active-user and inventory checks', () => {
    expect(migration).toMatch(/get_shared_inventory_id[\s\S]*public\.is_active_user\(\)/i);
    expect(migration).toMatch(/get_replenishment_suggestions[\s\S]*public\.is_active_user\(\)/i);
    expect(migration).toMatch(/get_inventory_dashboard[\s\S]*inventory_not_found/i);
    expect(migration).toMatch(/get_inventory_insights[\s\S]*inventory_not_found/i);
    expect(migration).toMatch(/consumption_history[\s\S]*movement_type = 'exit'/i);
  });

  it('allows only the server bootstrap context to promote the first administrator', () => {
    expect(migration).toMatch(/auth\.uid\(\) is null[\s\S]*return new/i);
  });

  it('prevents the current administrator from removing their own access', () => {
    expect(adminProtectionMigration).toMatch(/admin_self_access_protection/i);
    expect(adminProtectionMigration).toMatch(/old\.id = auth\.uid\(\)[\s\S]*old\.role = 'admin'/i);
  });

  it('hardens function search paths, RLS initplans and audit lookup performance', () => {
    expect(hardeningMigration).toMatch(/movement_result[\s\S]*set search_path = public/i);
    expect(hardeningMigration).toMatch(/select auth\.uid\(\)/i);
    expect(hardeningMigration).toMatch(/audit_logs_user_created_idx/i);
    expect(hardeningMigration).toMatch(/rls_auto_enable[\s\S]*revoke execute/i);
  });

  it('does not expose internal trigger and authorization helpers as RPC endpoints', () => {
    expect(internalFunctionMigration).toMatch(/assert_active_user[\s\S]*from public, anon, authenticated/i);
    expect(internalFunctionMigration).toMatch(/current_user_role[\s\S]*from public, anon, authenticated/i);
    expect(internalFunctionMigration).toMatch(/handle_new_user[\s\S]*from public, anon, authenticated/i);
    expect(internalFunctionMigration).toMatch(/protect_profile_fields[\s\S]*from public, anon, authenticated/i);
  });
});
