# Gol de Ouro - Validacao de Ranking

Data: 2026-06-05

## Fonte oficial

O ranking continua materializado na tabela `rankings`.

Depois da correcao, `refresh_rankings()` considera somente palpites de partidas encerradas para:

- `total_points`
- `correct_results`
- `exact_scores`

## Validacao de consistencia

Na auditoria inicial:

- 3 rankings existentes.
- 0 divergencias entre ranking persistido e soma derivada dos palpites.

No cenario QA:

- 12 usuarios autenticados.
- 12 palpites persistidos.
- 12 membros na liga QA.
- Ranking global atualizado apos encerramento da partida.
- Ranking da liga refletiu os mesmos pontos globais dos participantes.

## Observacao de produto

O ranking de liga atualmente usa a pontuacao global do usuario. Isso esta consistente entre telas, mas pode virar melhoria futura se o produto quiser ranking por campeonato/liga isolado.
# Atualização - 2026-06-06

## Validação Atual

- Ranking global atualizado a partir de `predictions.points`.
- QA validou top 3 após encerrar México x Canadá.
- Usuário principal atingiu 66 pontos, 1 resultado correto e 1 placar exato.
- Ranking de liga usa os mesmos pontos reais do ranking global filtrados por membros.
- Perfil usa os mesmos dados derivados de ranking/predictions.

## Risco Restante

- Ranking "Amigos" ainda depende de definição de produto/fonte social específica. "Minhas Ligas" já funciona como recorte real.

