# Controlled Fields Map

## Campos que podem permanecer como texto livre

- Nome do usuário.
- Nome da liga/grupo/competição.
- Email e senha nos fluxos de autenticação.
- Busca, filtro e pesquisa local.
- URLs técnicas de logo no Admin, apenas para criação manual de partida.

## Campos de regra de negócio que devem ser controlados

- Primeiro jogador a marcar: `PlayerPicker`, salva `player_id` ou `no_goals`.
- Homem do jogo: `PlayerPicker`, salva `player_id`.
- Vencedor do palpite: controle segmentado com `home`, `draw`, `away`.
- Ambos marcam: controle booleano.
- Cartão vermelho: controle booleano.
- Status da partida: calculado por janela/status do banco, exibido como badge.
- Campeonato: select/lista de campeonatos cadastrados.
- Time/seleção na criação manual Admin: select/lista a partir de jogadores e partidas conhecidas.
- Convite de grupo/liga: token e URL gerados pelo banco.
- Convite do app: token e URL gerados pelo banco.

## Risco removido

Novos palpites não salvam nome digitado de jogador. As colunas textuais legadas ficam nulas quando `player_id` ou `no_goals` é usado.
