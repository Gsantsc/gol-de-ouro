# ESPN result sync

O app nao usa API paga para criar jogos da Copa 2026.

Fluxo correto:

ESPN Scoreboard -> backend/admin job -> Supabase -> Admin/PWA/Mobile

O usuario nunca chama ESPN diretamente.

## Provider

Arquivo:

- `packages/shared/src/services/espn-provider.ts`

Endpoint padrao:

- `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard`

O provider padroniza:

- `eventId`
- time casa/visitante
- placar
- status ESPN
- estadio

## Sync pelo Admin

Rota:

- `POST /api/admin/sync-espn`

Botao:

- Admin > Partidas > Atualizar Resultados

A rota valida sessao admin antes de atualizar qualquer dado.

## Sync por job local

Dry-run:

```bash
npm run sync:espn:dry-run
```

Executar:

```bash
npm run sync:espn
```

Para simular uma data especifica:

```powershell
$env:ESPN_SCOREBOARD_DATE='20260611'; npm run sync:espn:dry-run
```

## Regras preservadas

- Autenticacao nao foi alterada.
- Aprovacao de usuarios nao foi alterada.
- Palpites nao foram alterados.
- Pontuacao usa o motor existente.
- Ranking usa o fluxo existente apos partida encerrada.
- Fallback `static-wc2026` continua existindo.

## Observacao

Quando a ESPN chama uma selecao por nome diferente, o sync aplica aliases seguros, por exemplo:

- `South Korea` -> `Korea Republic`
- `United States` -> `USA`

Se o calendario local divergir, o sync usa uma janela flexivel de kickoff e corrige nomes/data da partida com os dados da ESPN no Supabase.
