import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const scriptPath = join(process.cwd(), 'scripts', 'verify-supabase-remote.ps1');

describe('remote Supabase verification script', () => {
  it('checks the configured REST resources without requiring a service role key', () => {
    const script = readFileSync(scriptPath, 'utf8');

    expect(script).toMatch(/EXPO_PUBLIC_SUPABASE_URL/);
    expect(script).toMatch(/EXPO_PUBLIC_SUPABASE_ANON_KEY/);
    expect(script).toMatch(/Invoke-RestMethod/);
    expect(script).toMatch(/inventories/);
    expect(script).toMatch(/products/);
    expect(script).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it('can load Expo environment values from the local env file', () => {
    const script = readFileSync(scriptPath, 'utf8');

    expect(script).toMatch(/\.env\.local/);
    expect(script).toMatch(/Get-Content/);
    expect(script).toMatch(/PSScriptRoot/);
  });

  it('includes the PowerShell HTTP error details in the diagnostic', () => {
    const script = readFileSync(scriptPath, 'utf8');

    expect(script).toMatch(/ErrorDetails\.Message/);
  });

  it('distinguishes protected resources from a missing remote schema', () => {
    const script = readFileSync(scriptPath, 'utf8');

    expect(script).toMatch(/42501/);
    expect(script).toMatch(/sessão autenticada necessária/);
  });
});
