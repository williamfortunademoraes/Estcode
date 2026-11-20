# Fase 1 — Fundação do aplicativo

## Escopo entregue

- Projeto Expo SDK 58 com TypeScript em strict mode e Expo Router.
- Navegação principal com Dashboard, Produtos, Scanner, Estoque e Perfil.
- Tema visual baseado em React Native Paper com paleta azul, neutros e cores semânticas.
- Cliente Supabase isolado em `src/lib/supabase.ts`, usando somente `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- Persistência de sessão preparada com AsyncStorage para a Fase 2.
- Tipos iniciais de domínio para perfis, produtos, estoque e movimentações.
- Estrutura por responsabilidade em `src/components`, `src/lib`, `src/store`, `src/theme` e `src/types`.
- Estados vazios honestos: nenhum dado simulado é apresentado como dado real.

## Decisões técnicas

- O template `tabs` foi escolhido porque já configura o entrypoint do Expo Router e reduz risco de configuração manual.
- Módulos nativos foram alinhados ao Expo SDK 58; `expo-camera` e `expo-sqlite` ficam instalados para as fases que os utilizarão.
- O cliente Supabase é `null` quando o ambiente ainda não foi configurado. Isso mantém o shell navegável sem mascarar a ausência de backend.
- A camada de tipos local é provisória; após as migrations, deve ser substituída ou complementada pelos tipos gerados do Supabase.

## Observação histórica

Este documento registra a entrega original da Fase 1. As fases seguintes foram implementadas depois; o status consolidado está em [`implementation-status.md`](implementation-status.md).

## Validação

Executar `npm run typecheck` e `npm run lint`. Para validação visual, executar `npm run start` e abrir no Android ou web.
