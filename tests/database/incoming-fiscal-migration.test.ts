import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const migration = join(process.cwd(), 'supabase', 'migrations', '0010_incoming_fiscal_documents.sql');

describe('incoming fiscal migration', () => {
  it('keeps XML private, guards distribution and applies invoices transactionally', () => {
    expect(existsSync(migration)).toBe(true);
    const sql = readFileSync(migration, 'utf8');
    expect(sql).toMatch(/create table public\.incoming_fiscal_documents/i);
    expect(sql).toMatch(/create table public\.incoming_fiscal_document_items/i);
    expect(sql).toMatch(/values \('incoming-fiscal-xml', 'incoming-fiscal-xml', false/i);
    expect(sql).toMatch(/create or replace function public\.acquire_fiscal_sync_lease/i);
    expect(sql).toMatch(/select \* into document_row[\s\S]+for update/i);
    expect(sql).toMatch(/create or replace function public\.apply_incoming_fiscal_document/i);
    expect(sql).toMatch(/assert_active_user\(array\['admin'\]/i);
    expect(sql).toMatch(/source_fiscal_item_id/);
    expect(sql).toMatch(/fiscal_product_unit_mismatch/);
    expect(sql).toMatch(/fiscal_quantity_precision_unsupported/);
  });
});
