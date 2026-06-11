# Responsive Audit

## Problemas Encontrados

- Admin Partidas tinha linha horizontal muito larga, causando scroll lateral e conteúdo cortado em desktop estreito.
- Home do usuário web reutilizava lista de jogos, ficando parecida demais com a aba Jogos.
- Aba Jogos web não tinha filtros por status/data/busca.
- Card de jogo exibia o placar do palpite fora da aba Palpites, misturando responsabilidades.
- Ligas do usuário não tinham entrada clara para ver participantes no web.

## Correções Planejadas/Aplicadas

- Admin Partidas passa a usar grid responsivo em vez de linha flex com larguras rígidas.
- Home fica resumida: próximo jogo, contadores, ligas e notificações.
- Jogos vira tela completa: busca, status e data.
- Palpites vira o único local com placar enviado, pontos e resultado final.
- Ligas ganham botão "Entrar na liga" e detalhe com participantes.

## Breakpoints

- Mobile: 1 coluna, cards full width.
- Tablet: 2 colunas quando houver densidade suficiente.
- Desktop/Ultrawide: grids limitados por `max-w-7xl`, sem overflow horizontal.
