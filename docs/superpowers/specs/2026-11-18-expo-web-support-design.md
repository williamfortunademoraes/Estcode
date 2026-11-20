# Suporte Expo Web — desenho

## Intenção

Permitir que o aplicativo seja executado e utilizado no navegador com
`npx expo start --web`, mantendo a mesma base Expo/React Native usada no
mobile. A navegação, o layout e o cliente Supabase devem funcionar sem
imports exclusivos de uma plataforma no caminho comum.

## Objetivos

- Garantir dependências e configuração compatíveis com Expo SDK 58 para web.
- Manter a navegação do Expo Router funcional no navegador, incluindo rotas
  de tabs, modal e página de não encontrado.
- Disponibilizar um cliente Supabase configurado para variáveis públicas do
  Expo e persistência de sessão compatível com web e nativo.
- Ajustar as telas existentes para usar dimensões e espaçamentos adequados a
  janelas desktop e telas mobile.
- Validar com lint, TypeScript e export/build web.

## Não objetivos

- Migrar o projeto para outra versão do Expo ou substituir o Expo Router.
- Criar uma aplicação web paralela ou editar diretórios nativos gerados.
- Implementar uma funcionalidade de negócio ou fluxo de autenticação que não
  existe no projeto atual.

## Restrições

- O projeto usa npm (`package-lock.json` presente), portanto comandos de
  instalação usarão `npx expo install`.
- O Expo está na linha SDK 58; a configuração deve seguir a documentação
  versionada dessa linha.
- Variáveis expostas ao bundle devem usar o prefixo `EXPO_PUBLIC_`; chaves
  secretas nunca devem ser incluídas no cliente.
- APIs nativas devem ter implementação web equivalente ou ser isoladas por
  `Platform`/arquivos `.web`.

## Abordagens consideradas

1. **Ajuste incremental no projeto atual — escolhida.** Reaproveita Expo
   Router, Metro, `react-native-web` e `react-dom`; adiciona apenas a camada
   Supabase web-safe, configuração de ambiente e ajustes de layout. Tem menor
   risco e preserva o comportamento mobile.
2. **Atualizar todo o stack Expo/React Native.** Poderia trazer melhorias
   recentes para web, mas não é necessário para o requisito e aumenta o risco
   de incompatibilidades no template atual.
3. **Criar uma aplicação web separada.** Daria controle específico de browser,
   porém duplicaria navegação e componentes, contrariando o objetivo
   multiplataforma.

## Decisões de implementação

- Manter Metro como bundler web e tornar explícito o output estático do Expo
  Router para que as rotas possam ser exportadas e hospedadas futuramente.
- Criar `lib/supabase.ts` com `createClient`, usando `EXPO_PUBLIC_SUPABASE_URL`
  e `EXPO_PUBLIC_SUPABASE_ANON_KEY`. No navegador, a sessão será persistida
  em `localStorage`; em plataformas nativas, será usado AsyncStorage.
- Adicionar `.env.example` e uma validação clara para configuração ausente,
  sem colocar credenciais reais no repositório.
- Ajustar as telas e o layout de tabs com estilos flexíveis, largura máxima
  no desktop e preenchimento seguro no mobile.
- Proteger funcionalidades de abertura externa usando a implementação já
  existente de `ExternalLink`, mantendo o tratamento web/nativo separado.

## Verificação

- `npx expo lint`
- `npx tsc --noEmit`
- `npx expo export --platform web`
- Inicialização manual com `npx expo start --web` e verificação das rotas
  principais no navegador quando o ambiente permitir.
