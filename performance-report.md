# Beta fechado - performance

Data: 2026-06-06

## Resultado

Status: aprovado para beta local.

## Validacoes

- Build Next producao: aprovado.
- Export web do mobile: aprovado.
- Cache local em `useFootballData` reaproveita snapshot por usuario.
- Retry automatico em carregamento de dados.
- Realtime com polling fallback de 30s.
- Listas principais usam limites quando aplicavel: notificacoes e convites.

## Pontos de atencao

- `listGroupMembers` carrega membros globais; para beta de 10 a 50 usuarios e aceitavel.
- Antes de escalar alem do beta, filtrar membros por ligas do usuario/admin.
- Bundle web mobile gerado: `apps/mobile/dist-beta-validation`.

