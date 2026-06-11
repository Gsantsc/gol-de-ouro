# UX Priority Plan - Gol de Ouro

## P1 - Home, Jogos, Palpites

- Home deve ser centro do produto, com próximo jogo, contador, métricas, ligas, resultados recentes e notificações.
- Home não deve listar todos os jogos.
- Jogos deve listar todos os jogos com filtros por status.
- Jogos deve indicar `Palpite enviado` sem expor o placar do usuário.
- Palpites deve concentrar histórico completo, placar enviado, resultado e pontos.

## P2 - Ligas e Ranking

- Ligas devem funcionar como mini campeonatos.
- Cada liga precisa de card resumido e detalhe com ranking/participantes/convites.
- Ranking deve separar Global, Amigos e Minhas Ligas.
- Top 3 deve ter destaque visual.

## P3 - Perfil, Conquistas, Notificações e Onboarding

- Perfil deve exibir gamificação, conquistas, troféus, streak e evolução.
- Notificações devem aparecer visualmente mesmo quando não houver tabela populada, usando mock derivado dos dados atuais.
- Onboarding deve existir como componente visual preparado; persistência futura deve ser documentada se não houver flag no banco.

## Critérios de Segurança

- Não alterar auth.
- Não alterar provider.
- Não alterar banco/migrations sem aprovação.
- Não alterar cálculo de pontos.
- Não misturar Admin e Usuário.

