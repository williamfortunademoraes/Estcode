# ESTCODE — Consultor Inteligente de Estoque

Aplicativo Android em React Native + Expo para gestão, rastreabilidade e consultoria de estoque.

## Requisitos

- Node.js LTS
- npm
- Android Studio/emulador ou dispositivo Android com Expo Go compatível

## Configuração local

```powershell
Copy-Item .env.example .env
```

Preencha no `.env` (ou use o `.env.local` já ignorado pelo Git):

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_NFE_API_URL=https://your-nfe-api.example.com
```

Nunca coloque `service_role` no aplicativo.

O projeto Supabase usado no desenvolvimento deve ter as migrations aplicadas. A migration `0004_shared_inventory.sql` cria automaticamente o estoque compartilhado inicial; o app usa apenas a URL pública e a chave publishable/anon.

## Executar

```powershell
npm install
npm run start
```

Com o Metro aberto:

```powershell
npm run android
npm run web
```

## Build Android

Para gerar um APK de validação ou um AAB de produção pelo EAS, autentique o EAS CLI:

```powershell
npx eas-cli@latest login
npm run build:android
pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/build-android.ps1 -Profile production
```

O perfil `preview` gera APK para distribuição interna; `production` gera AAB para publicação. O build exige uma conta EAS e a configuração de credenciais Android.

## Validação

```powershell
npm run typecheck
npm run lint
npm test
npm run test:coverage
```

Ou execute a validação de código em um único comando:

```powershell
npm run verify
npm run verify:web
```

## Banco e funções Supabase

Com o Supabase CLI autenticado e o projeto vinculado:

```powershell
npx supabase link --project-ref bczcqcqokfkbajrnfpxl
npx supabase db push --remote --yes
npx supabase functions deploy admin-users --use-api --yes
```

Em execução automatizada/agente, `--yes` confirma explicitamente as alterações hospedadas. O Supabase Hosted fornece `SUPABASE_SERVICE_ROLE_KEY` à Edge Function; nunca copie esse valor para o aplicativo.

O fluxo também está automatizado em `scripts/deploy-supabase.ps1`:

```powershell
.\scripts\deploy-supabase.ps1
```

Depois do deploy, valide o schema remoto sem expor credenciais privilegiadas:

```powershell
./scripts/verify-supabase-remote.ps1
```

O verificador usa `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY` do ambiente atual. Como as tabelas exigem sessão autenticada, respostas `42501` para a chave pública sem login são esperadas e indicam que o schema existe e está protegido por RLS.

A `service_role` é usada somente pela Edge Function administrativa no servidor. Ela nunca deve ser colocada no `.env` do Expo.

## Primeiro administrador

O trigger de autenticação cria novos perfis como `operator` por padrão. Depois de criar a primeira conta e aplicar as migrations, promova-a uma única vez no SQL Editor do Supabase:

```sql
update public.profiles
set role = 'admin', updated_at = timezone('utc', now())
where id = '<AUTH_USER_UUID>';
```

Use o UUID do usuário autenticado; não coloque senha, token ou `service_role` neste repositório.

O deploy da Edge Function usa `--use-api` e não depende de Docker. Para desenvolvimento local com Docker:

```powershell
npx supabase start
npx supabase db reset
npx supabase db lint --local
```

Se houver PostgreSQL 16 instalado localmente, valide as migrations e as RPCs críticas em um cluster temporário, sem alterar nenhum banco existente:

```powershell
.\scripts\validate-postgres-migrations.ps1
```

## Funcionalidades entregues

- Autenticação por e-mail, recuperação de senha, sessão persistida e rotas protegidas.
- Perfis admin, operator e consultant com autorização no PostgreSQL/RLS.
- Cadastro, edição lógica, busca e filtros de produtos, categorias e fornecedores.
- Entrada, saída e ajuste transacionais via RPC, com bloqueio de linha, auditoria e idempotência.
- Histórico com filtros e atualização Realtime.
- Scanner de códigos EAN-8/EAN-13 com tratamento de permissão, repetição e código desconhecido.
- Dashboard, relatórios e consultoria determinística de reposição.
- Configuração do estoque com mínimo global aplicado como padrão somente quando o mínimo do produto é zero.
- Produtos com preço de venda, custo visível apenas para admins, detalhe separado da edição e foto privada.
- Consulta de NF-e via serviço Node separado, com mTLS A1 no host, lista/revisão e aplicação transacional após associação dos itens.
- Limite de operações pendentes preparado em Expo SQLite; operações não confirmadas não são exibidas como efetivadas.
- Falhas transitórias de rede nas movimentações são salvas localmente com `idempotency_key` e exibidas como pendentes; erros de permissão/validação não entram na fila.

O detalhamento por fase, riscos e pendências remotas está em [`docs/implementation-status.md`](docs/implementation-status.md).
A matriz de requisitos e suas evidências está em [`docs/requirements-matrix.md`](docs/requirements-matrix.md).

## Serviço fiscal de NF-e

O backend fiscal é independente do app Expo. Configure os segredos diretamente no secret manager do host (`NFE_CERTIFICATE_PFX_BASE64`, `NFE_CERTIFICATE_PASSWORD`), junto de `SUPABASE_URL` e `SUPABASE_ANON_KEY`, e execute `npm run nfe-api`. Configure `EXPO_PUBLIC_NFE_API_URL` no build do app. Não armazene o certificado A1 ou sua senha no projeto, em tabelas Supabase ou no cliente. Os detalhes e limites ainda não validados estão em [`services/nfe-api/README.md`](services/nfe-api/README.md).
