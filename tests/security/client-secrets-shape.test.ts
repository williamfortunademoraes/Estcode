import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('client secret boundary', () => {
  it('keeps privileged Supabase credentials out of the mobile client', () => {
    const clientSupabaseSource = readFileSync(join(process.cwd(), 'src', 'lib', 'supabase.ts'), 'utf8');
    const gitignore = readFileSync(join(process.cwd(), '.gitignore'), 'utf8');

    expect(clientSupabaseSource).not.toMatch(/SERVICE_ROLE|service_role/i);
    expect(gitignore).toMatch(/\.env\*\.local/);
  });
});
