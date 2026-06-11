# Gol de Ouro - Relatorio Final da Rodada

Data: 2026-06-05

## Correcoes aplicadas

- Palpites podem ser editados pelo dono enquanto a janela estiver aberta.
- Edicao apos fechamento e excluisao por usuario continuam bloqueadas.
- Service role pode limpar dados QA sem quebrar regra do usuario.
- Status das partidas ganhou funcao agendada por `pg_cron`.
- Pontuacao e ranking atualizam automaticamente quando a partida e encerrada.
- Conquistas foram normalizadas para regras persistidas.
- Notificacoes sao criadas em eventos reais de palpite criado, editado e pontuado.
- Home, Palpites, Ranking, Ligas e Perfil usam fontes coerentes.
- Web e mobile passam a compartilhar calculo de performance.
- Dashboard web/admin ganhou timeout de chamadas Supabase para evitar loading infinito.
- Navegacao mobile do dashboard foi ajustada para grid compacto sem overflow horizontal.
- Capturador visual CDP foi corrigido e gera evidencia real das telas.

## Arquivos principais alterados

- `supabase/migrations/20260605174500_user_flow_consistency.sql`
- `supabase/migrations/20260605182000_fix_prediction_update_guard.sql`
- `packages/shared/src/performance.ts`
- `apps/mobile/src/shared/performance.ts`
- `apps/admin/src/lib/user-api.ts`
- `apps/admin/src/lib/admin-api.ts`
- `apps/admin/src/lib/async-control.ts`
- `apps/admin/src/lib/supabase.ts`
- `apps/admin/src/app/globals.css`
- `apps/mobile/src/services/football.service.ts`
- `apps/admin/src/app/dashboard/page.tsx`
- `apps/mobile/src/screens/AppRoot.tsx`
- `apps/mobile/src/screens/HomeScreen.tsx`
- `apps/mobile/src/screens/PredictionsScreen.tsx`
- `apps/mobile/src/screens/ProfileScreen.tsx`
- `apps/mobile/src/screens/PredictionScreen.tsx`
- `apps/mobile/src/components/MatchCard.tsx`
- `scripts/qa-user-flow.cjs`
- `scripts/capture-user-flow-cdp.cjs`

## Validacoes aprovadas

- `npm run validate:match-rules`
- `npm run qa:user-flow`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npx expo export`
- `node scripts/capture-user-flow-cdp.cjs`

## Evidencias geradas

- `artifacts/qa-user-flow-evidence.json`
- `artifacts/qa-user-flow-visual-evidence.json`
- `artifacts/qa-user-flow-visual-evidence.gif`
- Prints individuais em `artifacts/qa-user-flow-*.png`

## Cleanup QA

- `npm run qa:user-flow` executado com sucesso.
- Cleanup final removido: usuarios QA, auth users QA, partida QA, liga QA, membros, palpites, notificacoes, conquistas, ranking e logs QA.
- Checagem independente confirmou: `qaUsers: 0`, `qaMatches: 0`, `qaGroups: 0`.

## Pendencias honestas

- Primeiro jogador a marcar e homem do jogo nao existem como feature implementada.

## Decisao

A camada de dados, persistencia, pontuacao, ranking, conquistas e notificacoes esta aprovada tecnicamente para seguir.

A aprovacao visual final tambem foi concluida com prints desktop/mobile e GIF de evidencia.
