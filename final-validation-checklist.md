# Final Validation Checklist - 2026-06-06

## P0

- `npm install --dry-run`: aprovado.
- `npx supabase status`: Supabase local rodando.
- `npx supabase db reset`: aprovado.
- `npm run admin`: aprovado via healthcheck em `/admin`.

## Build/Qualidade

- `npm run typecheck -w @gol-de-ouro/shared`: aprovado.
- `npm run typecheck -w @gol-de-ouro/mobile`: aprovado.
- `npm run typecheck -w @gol-de-ouro/admin`: aprovado.
- `npm run lint`: aprovado.
- `npm run build`: aprovado.
- `npx expo export --platform web --output-dir dist-validation`: aprovado e diretório temporário removido.

## Fluxo Funcional

- `npm run seed:players:wc2026`: aprovado.
- `npm run validate:match-rules`: aprovado.
- `npm run qa:user-flow`: aprovado.

## Evidências

- Banco resetado e migrations aplicadas do zero.
- Elencos WC2026 seedados: 240 jogadores, 48 seleções no roster.
- QA funcional salvo em `artifacts/qa-user-flow-evidence.json`.
