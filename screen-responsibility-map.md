# Screen Responsibility Map

## Home

Responsabilidade: resumo e atalhos. Mostra próximo jogo, contador, métricas, top ligas, últimos resultados e notificações. Não lista todos os jogos.

## Jogos

Responsabilidade: agenda completa de partidas e filtros. Mostra status, data, times e CTA de palpite. Se o usuário já palpitou, mostra apenas `Palpite enviado`.

## Palpites

Responsabilidade: histórico completo dos palpites. Mostra placar enviado, status do jogo, pontos, resultado oficial quando disponível e categorias.

## Ligas

Responsabilidade: competição social. Mostra cards das ligas, ranking interno, participantes e convites.

## Ranking

Responsabilidade: classificação. Separa Global, Amigos e Minhas Ligas. Não mistura ranking global com ranking de liga.

## Perfil

Responsabilidade: gamificação e desempenho. Mostra pontos, aproveitamento, acertos, placares exatos, streak, conquistas e evolução semanal.

## Notificações

Responsabilidade: feedback contextual. Usa tabela `notifications` quando existir; quando vazia, usa notificações derivadas dos dados carregados sem gravar no banco.

