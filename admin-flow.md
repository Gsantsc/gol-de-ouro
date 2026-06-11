# Gol de Ouro - Fluxos do Admin

Atualizado em 2026-06-05.

## Aprovacoes

Fluxo:

1. Admin acessa Aprovacoes.
2. Visualiza usuarios `pending`.
3. Aprova ou rejeita.
4. Usuario aprovado vira `approved`.
5. Usuario rejeitado ou suspenso fica bloqueado para palpites.

## Partidas

Fluxo:

1. Admin sincroniza jogos WC2026.
2. Partida entra com dados do provider.
3. Sistema calcula janelas de palpite.
4. Admin pode ajustar resultado oficial quando necessario.
5. Ao encerrar e pontuar, o banco recalcula pontos de forma idempotente.

Campos oficiais de resultado:

- placar casa;
- placar visitante;
- primeiro jogador a marcar;
- homem do jogo;
- cartao vermelho.

## Ranking

O ranking e atualizado a partir dos pontos salvos em `predictions` apos partida encerrada.

Indicadores principais:

- pontos totais;
- acertos;
- placares exatos;
- progresso semanal;
- posicao geral e por liga.

## Separacao Admin x Usuario

Admin gerencia dados operacionais, aprovacoes, partidas e rankings.

Usuario consome Home, Jogos, Palpites, Ligas e Perfil.

Os fluxos nao devem compartilhar tela nem acao sensivel.
