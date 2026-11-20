import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('generated database type contract', () => {
  it('represents audit logs exposed by the database schema', () => {
    const domainTypes = readFileSync(join(process.cwd(), 'src', 'types', 'domain.ts'), 'utf8');
    const databaseTypes = readFileSync(join(process.cwd(), 'src', 'types', 'database.ts'), 'utf8');

    expect(domainTypes).toMatch(/interface AuditLog/);
    expect(databaseTypes).toMatch(/audit_logs:\s*TableDefinition<AuditLog>/);
  });
});
