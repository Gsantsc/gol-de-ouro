# DIAGNÓSTICO FASE 1 - MAPEAMENTO COMPLETO DO SISTEMA

## ESTRUTURA DO PROJETO

### Apps
- **apps/admin**: Next.js + TypeScript + TailwindCSS (Painel Admin Web)
  - src/app/admin/ - Dashboard, aprovações, partidas, torneios, grupos, competições, ranking
  - src/app/api/ - API routes
  - src/lib/ - admin-api.ts, supabase.ts
  
- **apps/mobile**: React Native + Expo + TypeScript (App Mobile)
  - src/app/ - AppRoot.tsx
  - src/screens/ - AuthScreen, ApprovalScreen, HomeScreen, etc.
  - src/hooks/ - useAuth.tsx, useFootballData.ts, useMatchDetails.ts
  - src/services/ - auth.service.ts, football.service.ts, supabase.ts
  - src/components/ - UI components
  - src/navigation/ - Navigation
  - src/theme/ - Theme tokens

- **apps/web**: NÃO EXISTE (apenas admin e mobile)

### Packages
- **packages/shared**: Tipos, serviços compartilhados, tratamento de erros
  - src/services/matches-provider/ - local-provider.ts, api-football-provider.ts
  - src/services/ - error-handler.ts
  - src/types/ - tipos compartilhados

### Banco de Dados (Supabase/PostgreSQL)
- **supabase/migrations/** - Migrations do banco
  - 20260518140000_gol_de_ouro_schema.sql
  - 20260518170000_platform_expansion.sql
  - 20260519160000_auth_approvals_scoring.sql
  - 20260519170000_fix_approval_trigger.sql
- **supabase/seed.sql** - Dados iniciais
- **supabase/config.toml** - Configuração Supabase

### Services
- **services/matches-provider/** - Provider de partidas (local ou API-Football)

## FLUXOS DO SISTEMA

### 1. FLUXO ADMIN
**Login:**
- Email: configurado em `TEST_ADMIN_EMAIL`
- Senha: configurada em `TEST_ADMIN_PASSWORD`
- Role: admin (hardcoded no trigger enforce_single_admin_account)
- Status: approved (hardcoded no trigger)

**Dashboard:**
- loadAdminData() → metrics, users, matches, rankings, logs
- Tabs: dashboard, users, matches, tournaments, groups, competitions, ranking

**Aprovações:**
- loadPendingApprovals() → lista usuários pending
- approveUser() → status=approved, approved_at=now(), approved_by=admin_id
- rejectUser() → status=rejected, rejection_reason
- suspendUser() → status=suspended
- reactivateUser() → status=approved

**Partidas:**
- createMatch() → insert matches
- updateMatch() → update matches
- finishMatchAndScore() → status=encerrado, recalculate_match_points(), refresh_rankings()

**Sincronização:**
- syncAutomaticMatches() → API route /api/admin/sync-matches
- Matches provider: API-Football (real) ou local-fixtures (mock)

### 2. FLUXO PLAYER
**Cadastro:**
- signUp() → auth.users → trigger handle_new_auth_user → public.users
- Role: player (padrão)
- Status: pending (padrão)
- Tela: ApprovalScreen (aguardando aprovação)

**Login:**
- signIn() → auth.session → ensure_user_profile() → public.users
- Se status=pending → ApprovalScreen
- Se status=approved → App completo
- Se status=suspended → ApprovalScreen
- Se status=rejected → ApprovalScreen

**Dashboard:**
- listTournaments() → campeonatos
- listMatches() → partidas
- listMyPredictions() → meus palpites
- listRanking() → ranking geral
- listMyGroups() → meus grupos
- listAchievements() → minhas conquistas

### 3. FLUXO AUTH
**Cadastro:**
- signUp() → auth.users → trigger handle_new_auth_user → public.users

**Login:**
- signIn() → auth.session → ensure_user_profile() → public.users

**Verificação:**
- onAuthStateChange → loadProfile → check role/status → redirect

**Logout:**
- signOut() → auth.signOut() → session=null → profile=null

### 4. FLUXO APROVAÇÃO
**Usuário novo:**
- status=pending → ApprovalScreen → aguarda admin

**Admin aprova:**
- approve_user() RPC → status=approved, approved_at=now(), approved_by=admin_id
- Trigger sync_user_status_fields → sincroniza status/approval_status/blocked

**Usuário aprovado:**
- status=approved → pode acessar app completo

### 5. FLUXO PALPITES
**Janela:**
- prediction_open_at (24h antes do início)
- prediction_close_at (1h antes do início)

**Envio:**
- submitPrediction() → insert predictions
- Trigger ensure_prediction_submission → locked=true

**Proteção:**
- locked=true → não pode editar/excluir (trigger protect_locked_prediction)

**Pontuação:**
- finish_match_and_score() → recalculate_match_points() → refresh_rankings()
- Pontuação: exato=5, resultado=3, erro=0

### 6. FLUXO PARTIDAS
**Sincronização:**
- listMatches() → ensureTournament() → upsertProviderMatch()
- match_statistics + match_events

**Status:**
- aberto (antes do início)
- ao_vivo (durante o jogo)
- encerrado (após o fim)
- fechado (cancelado)

**Campeonatos:**
- world_cup, world_cup_2026, brasileirao_a, brasileirao_b, copa_do_brasil
- champions_league, libertadores, sul_americana
- premier_league, la_liga, serie_a_italiana, bundesliga

### 7. FLUXO RANKING
**Cálculo:**
- recalculate_match_points() → pontos por palpite
- refresh_rankings() → sum(predictions.points) → update rankings

**Atualização:**
- Automática quando partida termina
- Manual via force_refresh_rankings()

### 8. FLUXO GRUPOS
**Criação:**
- create_group() RPC → generate_invite_code() → insert groups + group_members (role=owner)

**Convite:**
- create_group_invite() → generate_invite_code() → insert group_invites

**Entrada:**
- join_group_by_invite() → insert group_members (role=member)

**Saída:**
- leave_group() → soft delete group_members

### 9. FLUXO COMPETIÇÕES
**Criação:**
- create_competition() RPC → insert competitions

**Membros:**
- competition_groups → grupos na competição

### 10. FLUXO CONQUISTAS
**Avaliação:**
- evaluate_user_achievements() → verifica condições

**Trigger:**
- predictions → evaluate_achievements_after_prediction()
- group_members → evaluate_achievements_after_group()

**Badges:**
- Primeiro Palpite, 3/5 Acertos, Placares Exatos, Top 1/3, Grupos

### 11. FLUXO REALTIME
**Subscriptions:**
- useFootballData.ts → app-live-data channel
- admin page.tsx → admin-live channel
- approvals page.tsx → admin-approvals-live channel
- useMatchDetails.ts → match-details-{matchId} channel
- useAuth.tsx → profile-{userId} channel

**Tabelas:**
- matches, rankings, match_events, groups, group_members
- achievements, competitions, competition_groups, predictions
- users

**Fallback:**
- Polling de 30 segundos se realtime falhar

## DIAGNÓSTICO INICIAL

### Observações:
1. **apps/web não existe** - Apenas apps/admin e apps/mobile
2. **Supabase local** - Configurado via `SUPABASE_URL`
3. **Admin de seed** - configure credenciais via ambiente antes de publicar
4. **Triggers importantes** - handle_new_auth_user, sync_user_status_fields, enforce_single_admin_account
5. **RLS policies** - Configuradas para segurança
6. **Realtime subscriptions** - Configuradas com fallback polling

### Próximos passos:
- FASE 2: Validação completa de autenticação
- FASE 3: Validação de cadastro + aprovação
- FASE 4: Validação de banco
- FASE 5: Validação de RLS e segurança
- FASE 6: Validação de partidas
- FASE 7: Validação de tempo real
- FASE 8: Validação de palpites
- FASE 9: Validação de ranking
- FASE 10: Validação de UX
- FASE 11: Detecção de bugs silenciosos
- FASE 12: Relatório final
