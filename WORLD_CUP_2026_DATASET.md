# Copa do Mundo 2026 - Dados proprios do produto

Este projeto nao depende mais de API externa para criar os jogos da Copa do Mundo 2026.

## Fonte interna

O dataset fica em:

- `scripts/world-cup-2026-dataset.cjs`

Ele gera:

- 104 partidas
- 48 selecoes
- 12 grupos
- datas, horarios, estadios e fase

As APIs externas devem ser usadas apenas para atualizar resultado, placar e status, nunca para criar fixtures no app.

## Importar partidas

```bash
npm run import:world-cup-2026
```

Teste sem gravar:

```bash
npm run import:world-cup-2026:dry-run
```

O importador e idempotente e usa `provider_name + provider_external_id` para nao duplicar jogos.

## Fila de sincronizacao

Tabela:

- `public.match_sync_queue`

Campos principais:

- `match_id`
- `provider`
- `last_sync_at`
- `sync_status`
- `next_sync_at`

A fila e preparada pelo importador.

## Sync de resultados

```bash
npm run sync:live-results
```

Teste sem gravar:

```bash
npm run sync:live-results:dry-run
```

O job atualiza janelas e status local. Resultado final so deve ser aplicado quando existir provider de placar confiavel configurado. Depois do sync, o script chama `jobs-matches` para recalcular pontos/ranking em jogos encerrados.

## Simulacao

```bash
npm run simulate:world-cup-2026
```

A simulacao nao grava no banco. Ela valida a cobertura completa do dataset e gera placares fake para QA.
