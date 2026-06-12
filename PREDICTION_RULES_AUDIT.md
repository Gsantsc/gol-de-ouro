# Gol de Ouro - Auditoria de Palpites

Data: 2026-06-12

## Estado validado

- Usuarios `pending`, `rejected` ou `suspended` nao conseguem palpitar.
- Usuarios aprovados conseguem criar e editar palpite somente dentro da janela aberta.
- A janela de palpite abre 24h antes do inicio da partida.
- A janela de palpite fecha 1h antes do inicio da partida.
- Partidas `ao_vivo` e `encerrado` bloqueiam novos palpites.
- Cada usuario tem no maximo um palpite por partida (`user_id, match_id`).
- O app mobile e o dashboard web salvam os mesmos campos oficiais.

## Mercados de palpite

- Placar exato.
- Vencedor.
- Primeiro jogador a marcar por `player_id`.
- Opcao "Sem gols" para primeiro jogador.
- Ambos marcam.
- Homem do jogo por `player_id`.
- Cartao vermelho.

## Persistencia

Os apps gravam em `public.predictions`:

- `predicted_home_score`
- `predicted_away_score`
- `predicted_winner`
- `predicted_first_scorer_id`
- `predicted_first_goal_no_goals`
- `predicted_both_teams_score`
- `predicted_man_of_match_id`
- `predicted_red_card`

Os nomes livres de jogador nao sao enviados pela UI. O banco ainda mantem campos legados de texto para compatibilidade, mas triggers limpam/preenchem esses campos a partir do jogador selecionado.

## Protecoes no banco

- `ensure_prediction_submission()` valida dono, aprovacao, partida existente, status e janela.
- `protect_locked_prediction()` bloqueia alteracoes indevidas e delete de palpites.
- RLS de `predictions` exige usuario aprovado e dono do palpite para insert/update.
- RLS de `players` permite leitura para admin ou usuario aprovado.

## Pontuacao

`recalculate_match_points(match_id)` considera:

- Placar exato: 10
- Vencedor correto ou empate correto: 5
- Diferenca de gols: 3
- Primeiro jogador: 8
- Ambos marcam: 2
- Homem do jogo: 6
- Cartao vermelho: 2
- Combo Ouro: +10
- Combo Perfeito: +20

## Validacoes executadas

- `npm run validate:match-rules`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run mobile:check:beta-env`
- `npm run qa:user-flow`

## QA ponta a ponta

O script `npm run qa:user-flow` foi executado com sucesso e validou:

- Usuario pending, rejected e suspended bloqueado pelo banco.
- Usuario aprovado conseguindo palpitar.
- Edicao de palpite enquanto a janela esta aberta.
- Edicao recusada apos fechamento da janela.
- Persistencia de `first_scorer_id` e `man_of_match_id`.
- Cartao vermelho e ambos marcam persistindo corretamente.
- Partida encerrada calculando pontos.
- Ranking, conquistas e notificacoes atualizados.
- Dados QA removidos no cleanup final.

Evidencia local gerada:

- `artifacts/qa-user-flow-evidence.json`

## Pontos de atencao antes do beta

- Garantir que `players` esteja populada no Supabase beta com `npm run seed:players:wc2026`.
- Garantir que os jogos oficiais estejam no Supabase beta com `npm run import:world-cup-2026:linked`.
- Rodar `npm run sync:espn:dry-run` antes de ativar sincronizacao real.
- Nao publicar `SUPABASE_SERVICE_ROLE_KEY` em frontend, Vercel client ou EAS.
