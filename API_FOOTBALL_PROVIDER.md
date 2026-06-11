# API-Football Provider

O provider API-Football e usado apenas em backend/sync.

Fluxo:

```txt
API-Football
-> sync backend/script/admin
-> Supabase
-> Admin, Web, PWA e Mobile
```

O app do usuario nunca chama API-Football diretamente.

## Variaveis

```txt
MATCHES_PROVIDER=api-football
MATCHES_FALLBACK_PROVIDER=static-wc2026
API_FOOTBALL_KEY=SUA_CHAVE
API_FOOTBALL_BASE_URL=https://v3.football.api-sports.io
API_FOOTBALL_INCLUDE_DETAILS=false
```

`API_FOOTBALL_KEY` nao pode usar prefixo `NEXT_PUBLIC` nem `EXPO_PUBLIC`.

## Endpoints

- `GET /fixtures?league=1&season=2026`
- `GET /teams?league=1&season=2026`
- `GET /players?team=TEAM_ID&season=2026`

Autenticacao:

```txt
x-apisports-key: API_FOOTBALL_KEY
```

Referencia oficial: https://www.api-football.com/documentation-v3

