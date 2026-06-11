# Gol de Ouro - Checklist de Validacao

Atualizado em 2026-06-06.

## Validacoes executadas

| Validacao | Comando | Status |
| --- | --- | --- |
| Regras de janela e pontuacao | `npm run validate:match-rules` | OK |
| TypeScript monorepo | `npm run typecheck` | OK |
| QA usuario real | `npm run qa:user-flow` | OK |
| Lint admin | `npm run lint` | OK |
| Build web/admin | `npm run build` | OK |
| Export mobile web | `npx expo export --platform web --output-dir dist-validation` | OK |

## Cenario QA coberto

- Criar usuarios.
- Validar que `pending`, `rejected` e `suspended` nao conseguem palpitar.
- Aprovar usuarios participantes.
- Login com usuario real.
- Criar partida aberta.
- Criar liga.
- Entrar na liga por convite.
- Enviar palpite com mercados oficiais.
- Editar palpite enquanto aberto.
- Fechar janela 1h antes.
- Rejeitar edicao apos fechamento.
- Encerrar jogo.
- Calcular pontos.
- Atualizar ranking.
- Atualizar conquistas/notificacoes.
- Validar liga com participantes.
- Limpar dados QA.

## Evidencias geradas

- `artifacts/qa-user-flow-evidence.json`
- `artifacts/qa-user-flow-visual-evidence.json`
- `artifacts/qa-user-flow-visual-evidence.gif`
- `artifacts/qa-user-flow-visual-evidence.avi`
- `artifacts/qa-prediction-modal-markets.png`
- Prints desktop, tablet e mobile em `artifacts/qa-user-flow-*.png`.

## Varredura do modal de palpite

Validado visualmente no dashboard em `Jogos > Palpitar`.

Mercados encontrados no modal:

- Placar.
- Vencedor.
- Primeiro jogador a marcar.
- Ambos marcam.
- Homem do jogo.
- Cartao vermelho.

## Bugs encontrados e corrigidos

- A funcao de pontuacao lia `red_cards_home` e `red_cards_away`, mas o banco local atual nao tinha essas colunas. Foi criada migracao de compatibilidade.
- A tela mobile de detalhes da partida ainda mostrava placar de palpite fora da aba Palpites. Foi ajustada para mostrar apenas estado resumido.

## Limites restantes

- MP4 nao foi gerado porque nao havia encoder disponivel no ambiente local. Foi gerado video AVI/MJPEG e GIF visual com as telas principais.
