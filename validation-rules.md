# Validation Rules

## Palpite

Antes de salvar, o banco valida:

- `user_id` pertence ao usuário autenticado.
- Usuário está aprovado e não bloqueado.
- `match_id` existe.
- Partida está dentro da janela aberta.
- Placar é número válido.
- Vencedor é `home`, `draw` ou `away`.
- Primeiro jogador é `player_id` válido ou `no_goals`.
- Homem do jogo é `player_id` válido quando preenchido.
- Ambos marcam e cartão vermelho são booleanos.

## Convite

- Token único e não previsível.
- Link ativo para entrada.
- Link expirado, revogado ou desativado não permite entrada.
- Regeneração invalida o link principal antigo.
- Convite do app só usa status permitidos: `pending`, `accepted`, `expired`, `revoked`.
