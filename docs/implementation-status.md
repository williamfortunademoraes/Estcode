# ESTCODE — status de implementação

## Fases

| Fase | Status | Entrega principal |
| --- | --- | --- |
| 1 | Concluída | Expo SDK 58, TypeScript strict, Router, tema Paper, Supabase, tipos e navegação |
| 2 | Concluída | Auth, sessão persistida, perfis, proteção de rotas, permissões, RLS e recuperação de senha |
| 3 | Concluída | Produtos, categorias, fornecedores, validação, busca, filtros e desativação lógica |
| 4 | Concluída | Migrations, RPCs transacionais, entradas, saídas, ajustes, histórico, auditoria, idempotência e Realtime |
| 5 | Concluída | Scanner Expo Camera para EAN-8/EAN-13, debounce e fluxo de cadastro de código desconhecido |
| 6 | Concluída | Dashboard, relatórios, indicadores e regras determinísticas de reposição |
| 7 | Concluída; APK preview gerado | Testes, lint, TypeScript, export web, Expo Doctor, deploy Supabase e build Android EAS |

## Versão 2.0 em desenvolvimento (`feature/estcode-v2`)

- Perfil: e-mail da sessão, edição segura do nome e entrada para recuperação de senha.
- Produtos: apresentação e edição em rotas separadas, preço de venda no catálogo, custo restrito ao admin, imagem em bucket privado com URL assinada.
- Estoque: mínimo global persistido; só substitui o mínimo do produto quando o valor individual é zero.
- NF-e: serviço Node separado, JWT e perfil admin validados, consulta por NSU com mTLS, persistência privada, conferência/mapeamento dos itens e RPC transacional para aplicar entrada.
- Migrations `0008` a `0011` validadas em PostgreSQL 16 temporário; a RPC fiscal foi exercitada com CNPJ, aplicação, idempotência e leitura RLS.
- Verificações locais da v2: TypeScript e ESLint aprovados; 26 suítes/83 testes; Expo Doctor 20/20; export web com 28 rotas.
- APK preview Android v2 concluído no EAS em 20/11/2026, build `4793d335-5a5b-433f-9a9b-2dc79ec8a3c3`, [baixar APK](https://expo.dev/artifacts/eas/WMFLKQo1Y6j19_MJSvLSK1G2j0YgrCQrfaz36lC1VJ0.apk).
- NF-e ainda depende de configurar CNPJ e provisionar o A1 diretamente no host; handshake, endpoint de homologação e chamada SEFAZ real não foram validados. Não há manifestação automática nem consulta agendada.
- Migrations 0008–0011 ainda não foram aplicadas no Supabase hospedado e o novo app/serviço ainda não foi publicado ou compilado para Android.

## Segurança aplicada

- O cliente mobile não recebe `service_role`.
- `stock_balances.quantity` não tem permissão de escrita direta para usuários da API.
- Entradas, saídas e ajustes usam RPC `SECURITY DEFINER`, checagem de usuário ativo/perfil, `SELECT ... FOR UPDATE`, idempotência e gravação atômica do histórico.
- A promoção do primeiro administrador é permitida somente no contexto confiável sem JWT de usuário; usuários autenticados comuns continuam impedidos de alterar `role`/`active`.
- RLS está habilitado nas tabelas expostas.
- A gestão administrativa de usuários usa a Edge Function `admin-users`, que mantém a chave privilegiada apenas no ambiente Supabase.
- O frontend reflete permissões, mas a autorização efetiva permanece no backend.
- A migration 0005 impede que o administrador autenticado remova o próprio acesso; a Edge Function aplica a mesma proteção antes de alterações administrativas.

## Validações executadas

- `npm test -- --coverage`: 20 suítes e 69 testes; cobertura global de 100% nas regras cobertas. O hook Realtime também tem regressão que reproduz a exceção ao registrar eventos em canal já inscrito.
- `npm run typecheck`: aprovado.
- `npm run lint`: aprovado sem warnings.
- `npx expo-doctor`: 20/20 verificações aprovadas.
- `npx expo export --platform web`: export aprovado com as rotas do aplicativo.
- As sete migrations foram executadas em ordem em um PostgreSQL 16 temporário com os objetos mínimos do Supabase; execução concluída sem erros.
- `scripts/validate-postgres-migrations.ps1` também executou as RPCs críticas com usuário autenticado, cobrindo entrada, idempotência, bloqueio de saldo negativo, saída, ajuste, proteção de auto-rebaixamento administrativo, rejeição de mutação por `consultant` e ausência de UPDATE direto em `stock_balances`.
- Os canais Realtime de Dashboard e Estoque usam nomes distintos por inventário, evitando registrar eventos depois de uma inscrição já iniciada.

## Ambiente remoto Supabase

O deploy remoto foi executado com o CLI autenticado no projeto `Estcode 01`:

```powershell
npx supabase link --project-ref bczcqcqokfkbajrnfpxl
npx supabase db push --remote --yes
npx supabase functions deploy admin-users --use-api --yes
```

Em 18/11/2026, as sete migrations foram aplicadas e a função `admin-users` ficou `ACTIVE` na versão 4. O MCP confirmou as nove tabelas públicas com RLS habilitado, sete migrations e uma Edge Function. Os advisors não apontam mais funções anônimas, search paths mutáveis ou initplans RLS; os avisos restantes correspondem aos RPCs de negócio e helpers necessários às políticas autenticadas. O verificador REST usa somente a chave pública e, sem sessão, retorna `42501` como esperado; isso confirma que o schema existe e que as tabelas permanecem protegidas por autenticação/RLS. O secret gerenciado `SUPABASE_SERVICE_ROLE_KEY` está presente no ambiente Supabase e não foi exposto.

O projeto EAS `@williamfortuna/estcode` está vinculado. O build obsoleto `94e2845f-042f-46be-bc11-86e4e1a965ad` foi cancelado; o APK preview com a correção de canais Realtime foi concluído no EAS em 18/11/2026 às 23:30 UTC, build `9b117f2d-5721-498c-ae0e-fbf059399f5e`. O arquivo está em [`dist/estcode-preview.apk`](../dist/estcode-preview.apk) e [disponível pelo EAS](https://expo.dev/artifacts/eas/mB8qTBy6zdnjaoN70xBabdAHtHBJYSK1vwODQdF1Bdw.apk); tem 126.070.841 bytes e SHA-256 `59DF06BBAC4832EC33878484CCF636FDD2BB4A999FA20ED67EC88DDD1D38F0EA`. O arquivo passou a verificação de estrutura ZIP e contém manifest Android, DEX e bibliotecas nativas. Não foi instalado em aparelho neste ambiente, que não tem Android SDK/ADB; essa validação manual permanece pendente.

O primeiro usuário administrador foi provisionado no Auth, está ativo com perfil `admin` e teve o login por senha validado. A senha temporária foi entregue ao titular na conversa e não foi gravada no repositório.

O lint local do Supabase não pôde ser executado sem um Postgres local ativo; ele requer Docker e `npx supabase start`. A sincronização offline completa permanece deliberadamente fora da primeira versão: falhas transitórias são persistidas na fila SQLite com idempotência, mas nenhuma operação pendente é apresentada como confirmada nem sincronizada automaticamente.

## Arquivos principais

- `supabase/migrations/`: schema, RLS, RPCs, Realtime e criação idempotente do estoque compartilhado.
- `supabase/functions/admin-users/`: operações administrativas protegidas.
- `eas.json`: perfis de build Android para APK de validação e AAB de produção; a execução requer login EAS.
- `src/features/`: regras, schemas, serviços e componentes por domínio.
- `src/app/`: rotas Expo Router.
- `tests/`: testes de regras, segurança estrutural, serviços e UI.
