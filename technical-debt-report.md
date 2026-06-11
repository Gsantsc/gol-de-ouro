# Technical Debt Report - 2026-06-06

## Dívidas Isoladas

- `apps/admin/src/app/api/admin/sync-matches/route.ts`: TODO para standings e lineups.
- `scripts/demo-user-flow.cjs`: script demo mantido de propósito; não é importado por telas de produção.
- `supabase/seed.sql`: contém comentários históricos sobre mock removido; não injeta partidas mock permanentes.
- `npm ls` reportou um item extraneous local em `node_modules`; não afeta build e pode ser limpo com `npm prune` se desejado.

## Regras Mantidas

- Sem `npm update --force`.
- Sem `npm audit fix --force`.
- Sem alteração de regra de negócio de pontuação.
- Sem alteração de autenticação/aprovação.
- Sem alteração do provider WC2026.
