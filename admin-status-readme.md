# Automação de Partidas

## Escopo

O job local `npm run jobs:matches` processa todos os jogos da Copa do Mundo 2026. Por padrão ele usa `world_cup_2026`, mas pode ser direcionado por `MATCH_JOB_CHAMPIONSHIP`.

- Recalcula `prediction_open_at` como 24h antes do início.
- Recalcula `prediction_close_at` como 1h antes do início.
- Atualiza status não encerrados para `fechado`, `aberto` ou `ao_vivo`.
- Pontua palpites de partidas já `encerrado` apenas quando há placar final.
- Atualiza `rankings` apenas quando pontos, acertos ou placares exatos mudam.

## Regras

- Antes de 24h do jogo: `fechado`.
- Entre 24h antes e 1h antes: `aberto`.
- A partir de 1h antes: `ao_vivo`.
- Se provider/admin marcar como `encerrado` com placar final: pontuação e ranking são recalculados.

## Pontuação

- Placar exato: 5 pontos.
- Acertou vencedor ou empate: 3 pontos.
- Acertou diferença de gols: 2 pontos.
- Erro total: 0 ponto.
- Palpite de ouro: multiplica por 2 se `is_golden_match = true`.
- Zebra: +2 se `is_upset = true` e acertou o resultado.
- 0x0 exato: +1.

## Como Executar

```bash
npm run jobs:matches
```

Para simular sem gravar no banco:

```bash
npm run jobs:matches:dry-run
```

Para validar a regra México x South Africa:

```bash
npm run validate:match-rules
```

## Ambiente

O job usa `SUPABASE_SERVICE_ROLE_KEY` ou `SUPABASE_SERVICE_KEY`, além de `SUPABASE_URL`.

## Produção

O mesmo comando pode ser usado por cron externo. Localmente, o botão Admin > Partidas > Atualizar status executa a rota protegida `POST /api/admin/update-match-statuses`.
