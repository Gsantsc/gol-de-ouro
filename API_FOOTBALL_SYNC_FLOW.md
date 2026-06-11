# API-Football Sync Flow

## Jogos

Comando:

```txt
npm run jobs:matches
```

Fluxo:

1. Busca fixtures da Copa do Mundo 2026 na API-Football.
2. Mapeia `fixture.id` para `provider_external_id`.
3. Salva ou atualiza em `matches`.
4. Atualiza janela de palpite.
5. Executa motor local de status, pontuacao e ranking.

Se a API retornar erro ou zero jogos, o sync registra fallback `static-wc2026` e nao apaga dados existentes.

## Sem duplicidade

Jogos usam:

```txt
provider_name=api-football
provider_external_id=fixture.id
```

