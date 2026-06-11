# Gol de Ouro - Validacao de Pontuacao

Data: 2026-06-05

## Regras validadas

As regras implementadas e validadas sao:

- Placar exato: 5 pontos.
- Resultado correto: 3 pontos.
- Mesma diferenca de gols: 2 pontos.
- Zebra com resultado correto: +2 pontos.
- 0x0 exato: +1 ponto.
- Jogo dourado: multiplica o total por 2.

## Evidencia automatizada

Comando executado:

```bash
npm run validate:match-rules
```

Resultado:

- Mexico x South Africa validado.
- 5 casos de status passaram.
- 6 casos de pontuacao passaram.

## Evidencia ponta a ponta

Comando executado:

```bash
npm run qa:user-flow
```

Resultado:

- 12 palpites criados por usuarios autenticados.
- Palpite principal editado de `1 x 0` para `2 x 1` enquanto a janela estava aberta.
- Edicao apos fechamento rejeitada.
- Resultado oficial `Mexico 2 x 1 South Africa`.
- Palpite principal recebeu 5 pontos.
- Ranking principal refletiu 5 pontos, 1 acerto e 1 placar exato.
- Evidencia JSON: `artifacts/qa-user-flow-evidence.json`.

## Fora do escopo implementado

Nao existem campos, tabelas, UI ou regra persistida para:

- Primeiro jogador a marcar.
- Homem do jogo.

Esses dois itens nao foram inventados nesta rodada porque seriam novas features e nao validacao/correcao do que ja existe.
# Atualização - 2026-06-06

## Validação Atual

- `npm run validate:match-rules`: aprovado com 13 casos de pontuação.
- `npm run qa:user-flow`: aprovado após `npx supabase db reset`.
- Pontuação principal validada: 66 pontos.
- Cálculo usa IDs de jogador para primeiro marcador e homem do jogo.
- `no_goals` validado para primeiro marcador.
- Colunas textuais legadas não são persistidas em novos palpites.

## Regras Confirmadas

- Placar exato: 10.
- Vencedor/empate correto: 5.
- Diferença de gols: 3.
- Primeiro jogador: 8.
- Ambos marcam: 2.
- Homem do jogo: 6.
- Cartão vermelho: 2.
- Combo Ouro: +10.
- Combo Perfeito: +20.

