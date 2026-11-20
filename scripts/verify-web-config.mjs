import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const appConfig = JSON.parse(readFileSync('app.json', 'utf8')).expo;
const supabaseSource = readFileSync('src/lib/supabase.ts', 'utf8');
const rootHtmlSource = readFileSync('src/app/+html.tsx', 'utf8');
const errors = [];

if (appConfig.web?.bundler !== 'metro') {
  errors.push('app.json must configure expo.web.bundler as metro');
}

if (appConfig.web?.output !== 'static') {
  errors.push('app.json must configure expo.web.output as static');
}

if (!rootHtmlSource.includes('useServerDocumentContext')) {
  errors.push('root HTML must use useServerDocumentContext for static web rendering');
}

if (!rootHtmlSource.includes('{headNodes}')) {
  errors.push('root HTML must render generated styles and metadata in headNodes');
}

if (!rootHtmlSource.includes('{bodyNodes}')) {
  errors.push('root HTML must render hydration bundles in bodyNodes');
}

try {
  execFileSync('git', ['check-ignore', '-q', '.env']);
} catch {
  errors.push('.env must be ignored');
}

if (!supabaseSource.includes("Platform.OS === 'web'")) {
  errors.push('Supabase storage must branch on the web platform');
}

if (!supabaseSource.includes('localStorage')) {
  errors.push('Supabase web storage must use localStorage');
}

if (!supabaseSource.includes('SupabaseClient<Database> | null')) {
  errors.push('Supabase client must remain nullable when env is unavailable');
}

if (process.argv.includes('--routes')) {
  const requiredRoutes = [
    'src/app/_layout.tsx',
    'src/app/(tabs)/_layout.tsx',
    'src/app/(tabs)/index.tsx',
    'src/app/(tabs)/products.tsx',
    'src/app/(tabs)/scanner.tsx',
    'src/app/(tabs)/inventory.tsx',
    'src/app/(tabs)/profile.tsx',
    'src/app/products/new.tsx',
    'src/app/products/[id].tsx',
    'src/app/reports/index.tsx',
    'src/app/settings/catalog.tsx',
    'src/app/settings/inventory.tsx',
    'src/app/users/index.tsx',
    'src/app/modal.tsx',
    'src/app/+not-found.tsx',
  ];

  for (const route of requiredRoutes) {
    if (!existsSync(route)) {
      errors.push(`missing route: ${route}`);
    }
  }

  if (existsSync('src/app/_layout.tsx')) {
    const rootSource = readFileSync('src/app/_layout.tsx', 'utf8');
    if (!rootSource.includes('PaperProvider')) {
      errors.push('root layout must provide the paper provider');
    }
  }

  if (existsSync('src/app/(tabs)/_layout.tsx')) {
    const tabsSource = readFileSync('src/app/(tabs)/_layout.tsx', 'utf8');
    if (!tabsSource.includes("from 'expo-router'") || !tabsSource.includes('<Tabs')) {
      errors.push('tabs layout must use Expo Router Tabs');
    }
  }
}

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join('\n'));
  process.exit(1);
}

console.log('web configuration checks passed');
