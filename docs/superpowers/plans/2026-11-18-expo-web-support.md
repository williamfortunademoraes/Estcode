# Expo Web Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar uma execução web funcional do aplicativo Expo com navegação, layout responsivo e cliente Supabase compatível com navegador e mobile.

**Architecture:** Reaproveitar Expo Router e React Native Web no caminho comum, envolvendo a árvore em `SafeAreaProvider`/`PaperProvider` e isolando apenas a persistência de sessão por plataforma. As telas serão rotas Expo Router reais e usarão componentes já existentes em `src/components` para manter largura máxima no desktop e preenchimento adaptável no mobile.

**Tech Stack:** Expo SDK 58, Expo Router, React Native Web, React Native Paper, Supabase JS, AsyncStorage, TypeScript, npm.

**Spec:** `docs/superpowers/specs/2026-11-18-expo-web-support-design.md`

## Global Constraints

- O comando de desenvolvimento web deve ser `npx expo start --web`.
- O Expo está na linha SDK 58; a configuração deve seguir a documentação versionada dessa linha.
- O projeto usa npm (`package-lock.json` presente), portanto comandos de instalação usarão `npx expo install`.
- Variáveis expostas ao bundle devem usar o prefixo `EXPO_PUBLIC_`; chaves secretas nunca devem ser incluídas no cliente.
- APIs nativas devem ter implementação web equivalente ou ser isoladas por `Platform`/arquivos `.web`.
- Não criar ou editar diretórios `ios/` e `android/` manualmente.

## Review Focus

- Configuração Supabase ausente ou inválida: o bundle deve continuar iniciando sem lançar durante o import, expondo estado não configurado de forma explícita.
- SSR/export web sem `window` disponível: a criação do cliente não pode acessar APIs do navegador no módulo durante renderização estática.
- Sessão web persistida e retorno OAuth: o storage web deve usar `localStorage` e habilitar detecção de sessão na URL apenas na web.
- Janela desktop larga e viewport mobile estreita: o conteúdo deve permanecer centralizado sem overflow horizontal.
- Acesso direto a `/modal` ou rota desconhecida no navegador: o Router deve renderizar a rota/modal ou a página `+not-found` sem quebrar o bundle.

### File Structure

- Modify: `app.json` — manter Metro e configurar output web estático.
- Modify: `.gitignore` — ignorar arquivos `.env` locais, mantendo `.env.example` versionável.
- Modify: `src/lib/env.ts` — validar variáveis públicas sem falha durante import.
- Modify: `src/lib/supabase.ts` — selecionar storage web/nativo e configurar auth.
- Modify: `app/_layout.tsx` — provider de tema, fontes e stack raiz.
- Create: `app/(tabs)/_layout.tsx` — navegação de tabs compatível com web.
- Modify: `app/(tabs)/_layout.tsx`, `app/(tabs)/index.tsx`, `app/(tabs)/products.tsx`, `app/(tabs)/scanner.tsx`, `app/(tabs)/inventory.tsx`, `app/(tabs)/profile.tsx` — navegação e telas responsivas existentes.
- Modify: `app/modal.tsx`, `app/+not-found.tsx` — modal e fallback navegáveis no browser.
- Verify: `app/(auth)/*` e `app/products/*` — rotas de autenticação e catálogo existentes incluídas no export web.
- Modify: `app/+html.tsx` — idioma, reset e fundo web coerentes com o tema claro.
- Modify: `src/components/AppScreen.tsx` — content container responsivo e seguro para desktop/mobile.
- Modify: `src/components/MetricCard.tsx` — card sem overflow em larguras reduzidas.
- Create: `components/ExternalLink.tsx` — abertura externa com tratamento web/native.
- Create: `scripts/verify-web-config.mjs` — checks automatizados de configuração e rotas web.
- Create: `.env.example` if missing — documentar apenas placeholders públicos do Supabase.

### Task 1: Harden web configuration and Supabase runtime

**Files:**
- Modify: `app.json`
- Modify: `.gitignore`
- Modify: `src/lib/env.ts`
- Modify: `src/lib/supabase.ts`
- Modify: `src/types/database.ts` — satisfazer os contratos de tabela do Supabase JS.
- Create/verify: `.env.example`

**Interfaces:**
- Consumes: `environment` exported by `src/lib/env.ts`.
- Produces: `supabase: SupabaseClient<Database> | null` from `src/lib/supabase.ts`, with web storage based on `window.localStorage` only when `Platform.OS === 'web'` and native storage based on AsyncStorage otherwise.

- [ ] **Step 1: Write the failing configuration checks**

  Add a temporary verification command/check that asserts `app.json.web.bundler` is `metro`, `app.json.web.output` is `static`, `.env` is ignored while `.env.example` is not ignored, and the Supabase module exposes a nullable client without requiring real credentials.

- [ ] **Step 2: Run the checks to verify the current state fails**

  Run: `node scripts/verify-web-config.mjs` (or the repository-equivalent check created for this task).

  Expected: FAIL because the current web output is not explicitly static, `.env` is not ignored, and the current Supabase storage is not selected by platform.

- [ ] **Step 3: Implement the configuration and storage boundary**

  Update `app.json` web output to `static`; add `.env`/`.env.*` ignore rules with an exception for `.env.example`; preserve the existing Zod-safe environment parsing; and implement a small `SupportedStorage` adapter that wraps `window.localStorage` asynchronously on web without reading `window` during SSR. Set `detectSessionInUrl` to `Platform.OS === 'web'`, keep `autoRefreshToken` and `persistSession` enabled, and leave the client `null` when configuration is unavailable.

- [ ] **Step 4: Run the checks to verify they pass**

  Run: `node scripts/verify-web-config.mjs` and `npx tsc --noEmit`.

  Expected: PASS with no TypeScript errors and no real Supabase credentials required.

- [ ] **Step 5: Commit**

  ```bash
  git add app.json .gitignore .env.example src/lib/env.ts src/lib/supabase.ts scripts/verify-web-config.mjs
  git commit -m "chore: prepare Expo web and Supabase runtime"
  ```

### Task 2: Restore universal navigation and responsive screens

**Files:**
- Modify: `app/_layout.tsx`
- Modify: `app/(tabs)/_layout.tsx`, `app/(tabs)/index.tsx`, `app/(tabs)/products.tsx`, `app/(tabs)/scanner.tsx`, `app/(tabs)/inventory.tsx`, `app/(tabs)/profile.tsx`
- Verify: `app/(auth)/*`, `app/products/*`
- Modify: `app/modal.tsx`, `app/+not-found.tsx`
- Modify: `app/+html.tsx`
- Modify: `src/components/AppScreen.tsx`
- Modify: `src/components/MetricCard.tsx`
- Create: `components/ExternalLink.tsx`

**Interfaces:**
- Consumes: `appTheme`, `AppScreen`, `SectionHeader`, `MetricCard`, and Expo Router APIs already present in the repository.
- Produces: routes `/(tabs)/`, `/(tabs)/two`, `/modal`, and `+not-found` that render through the same component tree on native and web.

- [ ] **Step 1: Write the failing route smoke checks**

  Extend the web verification to assert that the required route files exist and that `app/_layout.tsx` includes the root Stack plus `SafeAreaProvider`/`PaperProvider`, while the tabs layout imports `Tabs` from `expo-router`.

- [ ] **Step 2: Run the checks to verify they fail**

  Run: `node scripts/verify-web-config.mjs`.

  Expected: FAIL because the working tree currently lacks the main route files.

- [ ] **Step 3: Implement the root layout and routes**

  Preserve the existing root Stack, PaperProvider, authentication routes, catalog routes, and five business tabs. Use `Link`/`router` from `expo-router`; do not use browser-only navigation. Keep `SafeAreaView` inside `AppScreen` as the cross-platform inset boundary, and use flexible rows of `MetricCard` with `flexWrap`, `gap`, `maxWidth`, and width percentages that work across desktop and mobile. Keep the modal, catalog, auth, and not-found routes linkable from the browser.

- [ ] **Step 4: Run typecheck and export web**

  Run: `npx tsc --noEmit` and `npx expo export --platform web`.

  Expected: PASS; web export creates a static bundle without native-only module resolution errors.

- [ ] **Step 5: Commit**

  ```bash
  git add app src/components/AppScreen.tsx src/components/MetricCard.tsx
  git commit -m "feat: restore responsive Expo Router web screens"
  ```

### Task 3: Verify the complete developer workflow

**Files:**
- Modify: `package.json` only if the web script needs an explicit correction.
- No new runtime files unless verification exposes a required compatibility fix.

**Interfaces:**
- Consumes: completed routes and Supabase runtime from Tasks 1–2.
- Produces: a documented, passing web development workflow.

- [ ] **Step 1: Run project diagnostics**

  Run: `npx expo lint` and `npx expo-doctor`.

  Expected: lint passes; Expo Doctor reports no actionable dependency/config mismatch introduced by this work.

- [ ] **Step 2: Start the requested web command**

  Run: `npx expo start --web`.

  Expected: Metro starts in web mode and the browser can reach the tab index, secondary tab, modal, and not-found fallback without a runtime exception. Stop the dev server after the smoke check.

- [ ] **Step 3: Run the final verification set**

  Run: `npx tsc --noEmit; npx expo lint; npx expo export --platform web`.

  Expected: all commands exit successfully.

- [ ] **Step 4: Commit any narrowly scoped verification fix**

  Only if Step 1–3 reveal a compatibility issue, add a regression check first, make the smallest fix, rerun the complete verification set, and commit with a focused message.
