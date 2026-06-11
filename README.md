# Gol de Ouro

Aplicativo fullstack de bolao de futebol entre amigos. Nao e bet, nao envolve dinheiro e nao realiza apostas.

## Stack

- App principal: React Native + Expo + TypeScript, mobile-first e web responsivo.
- Admin: Next.js + TypeScript + TailwindCSS em `/admin`.
- Usuário web: Next.js + TypeScript em `/dashboard`.
- Backend: Supabase Auth, PostgreSQL, Realtime, RLS, funcoes SQL e auditoria.

## Estrutura

```txt
gol-de-ouro/
  apps/mobile       App Expo para usuarios
  apps/admin        Painel admin web em /admin e dashboard web do usuário em /dashboard
  packages/shared   Tipos e regras compartilhadas
  supabase          Config, migration e seed
```

## Rodando localmente

1. Instale dependencias:

```bash
npm install
```

2. Suba o Supabase local e aplique migration/seed:

```bash
npm run supabase:start
npm run supabase:reset
```

3. Copie as chaves exibidas pelo Supabase para os arquivos de ambiente:

```bash
cp .env.example .env
cp apps/admin/.env.local.example apps/admin/.env.local
cp apps/mobile/.env.example apps/mobile/.env
```

Se preferir, você também pode manter apenas o arquivo raiz `.env` e o admin/mobile vão carregar essas variáveis automaticamente.

4. Rode o app Expo:

```bash
npx expo start
```

Tambem funciona:

```bash
npm run mobile
```

5. Rode o painel admin:

```bash
npm run dev
```

Abra [http://localhost:3000/admin](http://localhost:3000/admin).

6. Rode a experiência web do usuário:

```bash
npm run user
```

Abra [http://localhost:3002/dashboard](http://localhost:3002/dashboard).

Também é possível acessar [http://localhost:3000/dashboard](http://localhost:3000/dashboard) quando o servidor admin estiver rodando; a interface continua separada da rota `/admin`.

## Admin inicial

Configure o admin local via `.env`:

- `TEST_ADMIN_EMAIL`
- `TEST_ADMIN_PASSWORD`

As permissoes nao sao hardcoded no frontend. O admin e validado pela tabela `public.users`, protegida por RLS.

## Regras principais implementadas

- Todo usuario novo entra com `approval_status = pending`.
- Usuarios pendentes veem: "Aguardando aprovação do administrador."
- Palpites abrem 24 horas antes e fecham 1 hora antes da partida.
- Palpite enviado fica `locked = true`, sem edicao e sem exclusao.
- Palpites adversarios ficam ocultos ate a partida estar `encerrado`.
- Ranking e placares atualizam via Supabase Realtime.
- Ao encerrar partida, a funcao `finish_match_and_score` calcula pontos e atualiza o cache `rankings`.
- Pontuacao: vencedor correto `+3`, placar exato `+5`, erro `0`.
- Dados administrativos e alteracoes de palpites sao auditados.
- Dados de negocio usam soft delete com `deleted_at` onde aplicavel.

## Correções recentes

### 1. Bug de aprovação de usuário admin
- **Problema**: Ao aprovar um usuário, o status não mudava de `pending` para `approved`.
- **Causa**: O trigger `sync_user_status_fields` estava sobrescrevendo o status definido pela função `approve_user`.
- **Solução**: Criada migration `20260519170000_fix_approval_trigger.sql` que adiciona verificação para preservar status quando explicitamente definido como `approved` por ação de admin.
- **Arquivo**: `supabase/migrations/20260519170000_fix_approval_trigger.sql`

### 2. Centralização de tratamento de erros
- **Problema**: Funções de tratamento de erros duplicadas em múltiplos arquivos (`readError`, `readAuthError`).
- **Solução**: Criado módulo centralizado `packages/shared/src/error-handler.ts` com:
  - `readError`: Leitura genérica de erros
  - `readAuthError`: Tratamento específico para erros de autenticação com mensagens em português
  - `readDatabaseError`: Tratamento para erros de banco de dados
- **Impacto**: Removidas duplicações em `apps/admin/src/app/admin/page.tsx`, `apps/admin/src/app/admin/approvals/page.tsx`, e `apps/mobile/src/screens/AuthScreen.tsx`.

### 3. Sistema de partidas com todas as competições até Dezembro 2026
- **Implementação**: Configurado seasons para cada campeonato no sync de partidas:
  - `world_cup_2026`: 2026
  - `brasileirao_a`, `brasileirao_b`, `copa_do_brasil`: 2025
  - `champions_league`, `libertadores`, `sul_americana`: 2025
  - `premier_league`, `la_liga`, `serie_a_italiana`, `bundesliga`: 2025
- **Arquivo**: `apps/admin/src/app/api/admin/sync-matches/route.ts`
- **Funcionalidade**: Botão "Sincronizar jogos automáticos" no painel admin busca partidas de todas as competições configuradas.

## Supabase

A migration cria:

- `users`
- `tournaments`
- `matches`
- `match_statistics`
- `predictions`
- `rankings`
- `match_events`
- `admin_logs`
- `prediction_audit_logs`

Tambem cria policies RLS, funcoes RPC de admin, triggers de janela de palpite, protecao de palpite travado e publicacao Realtime.

## Scripts

```bash
npm run dev        # Admin Next.js
npm run user       # Dashboard web do usuário
npm run mobile     # Expo
npm run typecheck  # TypeScript nos workspaces
npm run build      # Build dos workspaces com build
```
