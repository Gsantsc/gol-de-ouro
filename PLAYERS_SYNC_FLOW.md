# Players Sync Flow

Comandos:

```txt
npm run seed:players:api-football
npm run seed:players:api-football:dry-run
```

Fluxo:

1. Busca selecoes da Copa do Mundo 2026.
2. Para cada selecao, busca jogadores em `/players`.
3. Salva em `players`.
4. Mobile/PWA/Admin leem jogadores apenas do Supabase.

## Sem duplicidade

Jogadores usam:

```txt
team_code + name
external_id=player.id
source=api-football
```

## Rate limit

Por padrao:

```txt
API_FOOTBALL_MAX_PLAYER_TEAMS=48
API_FOOTBALL_MAX_PLAYER_PAGES=1
```

Isso evita paginacao infinita e protege o limite diario.

