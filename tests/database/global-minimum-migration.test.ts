import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const migrationPath = join(process.cwd(), 'supabase', 'migrations', '0009_global_minimum_stock.sql');

describe('global stock minimum migration', () => {
  it('adds a validated inventory default and applies it to alerts and replenishment results', () => {
    expect(existsSync(migrationPath)).toBe(true);
    const sql = readFileSync(migrationPath, 'utf8');
    expect(sql).toMatch(/global_minimum_stock numeric\(14,\s*3\) not null default 0/i);
    expect(sql).toMatch(/global_minimum_stock_nonnegative\s+check/i);
    expect(sql.match(/coalesce\(nullif\(p\.minimum_stock,\s*0\),/gi)?.length).toBeGreaterThanOrEqual(2);
    expect(sql).toMatch(/create or replace function public\.get_inventory_dashboard/i);
    expect(sql).toMatch(/create or replace function public\.get_replenishment_suggestions/i);
  });
});
