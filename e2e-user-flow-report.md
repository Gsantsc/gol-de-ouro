# Beta fechado - fluxo E2E

Data: 2026-06-06

## Resultado

Status: aprovado em simulacao local automatizada.

## Fluxos cobertos

- Criacao de usuarios QA aprovados.
- Guardas para usuarios pending/rejected/suspended.
- Criacao, edicao e bloqueio de edicao de palpite apos fechamento.
- Player picker persistindo `predicted_first_scorer_id` e `predicted_man_of_match_id`.
- Entrada em liga via convite.
- Regeneracao, revogacao e rejeicao de convite antigo.
- Convite do app aceito e revogado.
- Encerramento de partida e pontuacao.
- Ranking, perfil, conquistas e notificacoes atualizados.

## Resultado do QA

- Palpites criados: 12
- Ranking top 3 gerado
- Notificacoes criadas: palpite registrado, atualizado e pontuado
- Limpeza final executada pelo proprio script

## Evidencia

- `artifacts/qa-user-flow-evidence.json`

