import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const functionSource = readFileSync(join(process.cwd(), 'supabase', 'functions', 'admin-users', 'index.ts'), 'utf8');
const supabaseConfig = readFileSync(join(process.cwd(), 'supabase', 'config.toml'), 'utf8');

describe('admin-users Edge Function contract', () => {
  it('routes list, invite and access changes through the server function', () => {
    expect(functionSource).toMatch(/payload\.action === 'list'/);
    expect(functionSource).toMatch(/payload\.action === 'invite'|request\.method === 'POST'/);
    expect(functionSource).toMatch(/payload\.action === 'update_access'/);
  });

  it('keeps privileged credentials server-side and checks the admin profile', () => {
    expect(functionSource).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(functionSource).toMatch(/profile\.role !== 'admin'/);
    expect(functionSource).toMatch(/profile\?\.active/);
    expect(functionSource).toMatch(/payload\.id === actor\.id[\s\S]*payload\.role !== 'admin'/);
  });

  it('requires JWT verification at the Supabase function boundary', () => {
    expect(supabaseConfig).toMatch(/\[functions\.admin-users\][\s\S]*verify_jwt\s*=\s*true/i);
  });
});
