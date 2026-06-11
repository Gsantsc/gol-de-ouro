# Setup do Supabase Beta - Gol de Ouro

## Status Atual
- ✅ Supabase beta remoto configurado
- ✅ URL pública acessível
- ✅ Publishable key configurada
- ✅ App mobile conectado ao Supabase beta
- ⏳ Service role beta pendente (necessário para migrations/seed)

## Configuração Atual

### Supabase Beta
- **URL**: https://ducbujfguxyjqrjjvjxu.supabase.co
- **Publishable Key**: sb_publishable_xVYiaDfdL6rRkojrnaVgtw_FUWEytkj
- **Environment**: beta

### App Mobile
- **EXPO_PUBLIC_SUPABASE_URL**: https://ducbujfguxyjqrjjvjxu.supabase.co
- **EXPO_PUBLIC_SUPABASE_ANON_KEY**: sb_publishable_xVYiaDfdL6rRkojrnaVgtw_FUWEytkj
- **EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY**: sb_publishable_xVYiaDfdL6rRkojrnaVgtw_FUWEytkj

## Estrutura do Banco de Dados

### Tabelas Principais
- `auth.users` - Autenticação Supabase
- `public.users` - Perfis de usuários
- `public.tournaments` - Campeonatos
- `public.matches` - Partidas
- `public.predictions` - Palpites
- `public.rankings` - Rankings
- `public.groups` - Grupos
- `public.group_members` - Membros de grupos
- `public.competitions` - Competições
- `public.achievements` - Conquistas
- `public.admin_logs` - Logs de admin
- `public.match_statistics` - Estatísticas de partidas
- `public.match_events` - Eventos de partidas

## Migrations

### Migrations Aplicadas
- `20260518140000_gol_de_ouro_schema.sql` - Schema inicial
- `20260518170000_platform_expansion.sql` - Expansão da plataforma
- `20260518180000_remove_unsupported_championships.sql` - Remoção de campeonatos não suportados
- `20260519160000_auth_approvals_scoring.sql` - Auth, aprovações e scoring
- `20260519170000_fix_approval_trigger.sql` - Fix trigger de aprovação
- `20260520200000_add_updated_at_columns.sql` - Colunas updated_at
- `20260520210000_api_football_tables.sql` - Tabelas API-Football
- `20260604120000_match_status_automation.sql` - Automação de status de partidas
- `20260605131500_user_public_ranking_access.sql` - Acesso público ao ranking
- `20260605174500_user_flow_consistency.sql` - Consistência do fluxo de usuário
- `20260605182000_fix_prediction_update_guard.sql` - Fix guard de atualização de palpite
- `20260605193000_official_prediction_markets.sql` - Mercados de palpite oficiais
- `20260605200500_match_red_card_compatibility.sql` - Compatibilidade cartão vermelho
- `20260606123000_player_picker_predictions.sql` - Palpites de seleção de jogador
- `20260606133000_clear_player_market_text.sql` - Limpeza de texto de mercado de jogador
- `20260606134000_fix_prediction_update_internal_fields.sql` - Fix campos internos de atualização
- `20260606141000_unique_invite_links.sql` - Links de convite únicos
- `20260606193000_beta_feedback.sql` - Feedback beta

## Seed Data

### Dados de Seed Pendentes
Quando a service role beta estiver disponível, executar:

```bash
# Aplicar migrations
npx supabase db push --remote beta

# Rodar seed
npx supabase db seed --remote beta

# Criar admin beta
node scripts/create-admin-profile.js
```

### Dados Mínimos para QA
- Usuário admin (gbieldev@hotmail.com)
- Campeonatos suportados
- Partidas de teste
- Usuários de teste
- Grupos de teste

## RLS Policies

### Policies Implementadas
- **Users**: SELECT próprio ou admin, UPDATE apenas admin
- **Matches**: SELECT approved ou admin, INSERT/UPDATE apenas admin
- **Predictions**: SELECT próprio ou (approved + match encerrado), INSERT approved + próprio
- **Rankings**: SELECT approved (apenas users approved)

## Triggers Importantes

- `handle_new_auth_user` - Cria profile ao cadastrar
- `sync_user_status_fields` - Sincroniza status/approval_status/blocked
- `enforce_single_admin_account` - Garante único admin
- `ensure_prediction_submission` - Valida palpite ao enviar
- `protect_locked_prediction` - Protege palpite travado
- `predictions_evaluate_achievements` - Avalia conquistas após palpite
- `matches_prediction_window` - Define janela de palpite
- `matches_touch_updated_at` - Atualiza timestamp

## RPC Functions

### Auth
- `ensure_user_profile()` - Cria/atualiza profile
- `record_user_login()` - Registra login
- `is_admin()` - Verifica role admin
- `is_approved_user()` - Verifica status approved

### Admin
- `approve_user()` - Aprova usuário
- `reject_user()` - Rejeita usuário
- `suspend_user()` - Suspende usuário
- `reactivate_user()` - Reativa usuário
- `soft_remove_user()` - Soft delete usuário
- `admin_user_overview()` - Visão geral de usuários
- `admin_dashboard_metrics()` - Métricas do dashboard

### Partidas
- `finish_match_and_score()` - Encerra partida e calcula pontos
- `recalculate_match_points()` - Recalcula pontos de uma partida
- `force_refresh_rankings()` - Força recálculo do ranking
- `refresh_rankings()` - Atualiza rankings globais

### Grupos
- `create_group()` - Cria grupo
- `create_group_invite()` - Gera convite
- `join_group_by_invite()` - Entra por convite
- `leave_group()` - Sai do grupo
- `close_group()` - Fecha grupo
- `remove_group_member()` - Remove membro

## Próximos Passos

1. **Obter service role beta** - Necessário para migrations/seed
2. **Aplicar migrations no beta remoto** - Usar service role
3. **Rodar seed no beta remoto** - Criar dados de teste
4. **Criar admin beta** - Usuário administrador
5. **Validar estrutura** - Verificar se todas as tabelas existem
6. **Testar conectividade** - Validar conexão do app

## Validação

### Checklist
- [ ] Service role beta obtida
- [ ] Migrations aplicadas no beta remoto
- [ ] Seed data criada no beta remoto
- [ ] Admin beta criado
- [ ] Conectividade do app validada
- [ ] RLS policies testadas
- [ ] RPC functions testadas
- [ ] Triggers testados

## Troubleshooting

### Erro: Connection refused
**Causa**: URL do Supabase incorreta ou serviço down
**Solução**: Verificar URL e status do Supabase

### Erro: Permission denied
**Causa**: Service role não configurada ou incorreta
**Solução**: Verificar service role e permissões

### Erro: Table does not exist
**Causa**: Migrations não aplicadas
**Solução**: Aplicar migrations com service role

## Segurança

### Regras
- ❌ Nunca expor service role no app mobile
- ✅ Usar apenas publishable/anon key no mobile
- ✅ Validar RLS policies no backend
- ✅ Usar RPC functions para operações sensíveis
- ✅ Implementar rate limiting
- ✅ Monitorar logs de acesso
