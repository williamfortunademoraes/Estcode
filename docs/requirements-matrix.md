# ESTCODE — matriz de requisitos e evidências

| Requisito | Evidência no repositório | Estado |
| --- | --- | --- |
| Expo, TypeScript strict e Expo Router | `package.json`, `tsconfig.json`, `src/app/` | Implementado |
| Tema e navegação com cinco áreas | `src/theme/`, `src/app/(tabs)/_layout.tsx` | Implementado |
| Supabase/Auth com sessão persistida | `src/lib/supabase.ts`, `src/features/auth/`, `src/store/auth-store.ts` | Implementado |
| Perfis e autorização | RLS em `supabase/migrations/0001_initial_schema.sql`, `src/features/auth/permissions.ts`, bootstrap controlado do primeiro admin | Implementado |
| Produtos, categorias e fornecedores | `src/features/products/`, `src/app/products/`, `src/app/settings/catalog.tsx` | Implementado |
| Entradas, saídas e ajustes transacionais | RPCs `register_stock_*` na migration inicial e `inventory-service.ts` | Implementado |
| Bloqueio de saldo negativo e exceções administrativas | `inventory_settings`, RPC de saída e `src/app/settings/inventory.tsx` | Implementado |
| Histórico com filtros | `listStockHistory`, `src/app/(tabs)/inventory.tsx` | Implementado |
| Auditoria, concorrência e idempotência | `audit_logs`, `FOR UPDATE`, `idempotency_key` nas RPCs | Implementado |
| Scanner EAN-8/EAN-13 | `src/app/(tabs)/scanner.tsx`, `expo-camera` | Implementado |
| Dashboard, relatórios e consultoria | `src/features/dashboard/`, `src/features/consultancy/`, `src/app/reports/` | Implementado |
| Realtime de saldo, histórico e dashboard | `src/features/inventory/use-stock-realtime.ts` | Implementado |
| Preparação offline | `src/features/offline/pending-operations.native.ts`, `.web.ts` | Implementado como fila pendente; sincronização futura |
| Administração de usuários | `supabase/functions/admin-users/`, `src/features/users/` | Implementado e publicado no Supabase |
| Testes e verificações | `tests/`, `npm run verify`, `npm run verify:web` | Validado localmente |
| Migrations aplicadas no Supabase remoto | `scripts/verify-supabase-remote.ps1` + MCP Supabase | Validado: 7 migrations aplicadas e 9 tabelas com RLS |
| Build Android publicado | `eas.json` e jobs EAS | Projeto criado; APK preview enviado e aguardando fila |

## Incrementos v2 em desenvolvimento

| Requisito | Evidência | Estado |
| --- | --- | --- |
| Mínimo global de estoque | migration `0009_global_minimum_stock.sql`, `replenishment-rules.ts` | Implementado; PostgreSQL local validado |
| Detalhe/edição de produto separados e imagem privada | `/products/[id]`, `/products/[id]/edit`, Storage privado | Implementado; não publicado |
| Consulta/importação de NF-e por CNPJ com certificado A1 | `services/nfe-api/`, `src/app/invoices/`, migrations `0010` e RPC de aplicação | Implementação inicial; exige certificado/host e teste real de mTLS |
| Permissão para helpers usados em RLS | migration `0011_grant_rls_helpers.sql` | Corrigido e validado no PostgreSQL local; ainda não aplicado no remoto |
| Validação Android v2 | build EAS `4793d335-5a5b-433f-9a9b-2dc79ec8a3c3` | APK preview concluído; disponível pelo EAS |

O deploy remoto reproduzível está em `scripts/deploy-supabase.ps1`; ele não manipula nem grava a `service_role`.

## Evidências da última validação

- 19 suítes e 67 testes aprovados.
- Cobertura global de 100% nas regras cobertas.
- TypeScript, ESLint e `npx expo lint` aprovados.
- Expo Doctor: 20/20 verificações aprovadas.
- `npm run verify:web`: configuração e export de 25 rotas aprovados.
- Migrations SQL executadas com sucesso em PostgreSQL 16 temporário e aplicadas no projeto Supabase remoto.
- RPCs críticas exercitadas em `scripts/validate-postgres-migrations.ps1`, incluindo idempotência, autorização por perfil e bloqueio de escrita direta no saldo.
- MCP Supabase autenticado e consultado; projeto remoto confirmou 7 migrations, 9 tabelas com RLS e a Edge Function `admin-users` ativa na versão 4.
- Verificador pós-deploy criado em `scripts/verify-supabase-remote.ps1` e coberto por teste estrutural.
