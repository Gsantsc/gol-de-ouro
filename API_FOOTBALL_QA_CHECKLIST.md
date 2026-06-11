# API-Football QA Checklist

## Backend

```txt
npm run jobs:matches
npm run seed:players:api-football
```

## Validacao local

```txt
npm run typecheck
npm run lint
npm run build
```

## Banco

Validar no Supabase:

```sql
select count(*) from matches where provider_name = 'api-football';
select count(*) from players where source = 'api-football';
```

## Produto

- Admin > Partidas mostra jogos sincronizados.
- Provider aparece como `api-football`.
- PWA/mobile mostram jogos vindos do Supabase.
- Palpite usa PlayerPicker.
- Primeiro jogador e homem do jogo salvam IDs.
- Nenhum campo de jogador e digitado livremente.
- Nenhum segredo esta em `NEXT_PUBLIC` ou `EXPO_PUBLIC`.

