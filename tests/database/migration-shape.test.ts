import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const migrationPath = join(
  process.cwd(),
  'supabase',
  'migrations',
  '0001_initial_schema.sql',
);
const sharedInventoryMigrationPath = join(
  process.cwd(),
  'supabase',
  'migrations',
  '0004_shared_inventory.sql',
);

describe('Supabase foundation migration', () => {
  it('defines the complete stock domain schema', () => {
    expect(existsSync(migrationPath)).toBe(true);

    const sql = readFileSync(migrationPath, 'utf8');
    for (const table of [
      'profiles',
      'inventories',
      'categories',
      'suppliers',
      'products',
      'stock_balances',
      'stock_movements',
      'audit_logs',
      'inventory_settings',
    ]) {
      expect(sql).toMatch(new RegExp(`create table public\\.${table}`, 'i'));
    }
  });

  it('protects balances and exposes only transactional movement RPCs', () => {
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toMatch(/enable row level security/i);
    expect(sql).toMatch(/revoke all on table public\.stock_balances from anon, authenticated/i);
    expect(sql).toMatch(/register_stock_entry/i);
    expect(sql).toMatch(/register_stock_exit/i);
    expect(sql).toMatch(/register_stock_adjustment/i);
    expect(sql).toMatch(/for update/i);
    expect(sql).toMatch(/idempotency_key/i);
  });

  it('creates the initial shared inventory as a deployable migration', () => {
    expect(existsSync(sharedInventoryMigrationPath)).toBe(true);
    const sql = readFileSync(sharedInventoryMigrationPath, 'utf8');
    expect(sql).toMatch(/insert into public\.inventories/i);
    expect(sql).toMatch(/00000000-0000-0000-0000-000000000001/i);
    expect(sql).toMatch(/insert into public\.inventory_settings/i);
    expect(sql).toMatch(/on conflict/i);
  });
});
