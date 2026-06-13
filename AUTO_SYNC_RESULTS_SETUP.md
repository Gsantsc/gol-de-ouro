# Auto Sync Results Setup

## Como funciona

O fluxo central fica em `apps/admin/src/server/sync-results.ts`.

1. GitHub Actions ou o Admin chama `POST /api/admin/sync-results`.
2. O endpoint valida `Authorization: Bearer <token>`.
3. Se o token for `CRON_SECRET`, a execucao e marcada como `cron`.
4. Se for token de sessao, o endpoint valida que o usuario e admin aprovado.
5. O servidor cria um client Supabase com `SUPABASE_SERVICE_ROLE_KEY`.
6. O sync consulta partidas no escopo seguro, busca resultados ESPN, atualiza partidas, recalcula pontos, ranking, classificacao e mata-mata.
7. Logs sao gravados em `match_provider_runs`.

O PWA/mobile nao chamam ESPN nem outra API externa. Eles continuam lendo dados atualizados do Supabase.

## Envs do Vercel Admin

Obrigatorias:

```env
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
CRON_SECRET=um-token-longo-aleatorio
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Provider:

```env
ESPN_PROVIDER_ENABLED=true
MATCHES_PROVIDER=static-wc2026
MATCHES_FALLBACK_PROVIDER=static-wc2026
```

Opcionais:

```env
ESPN_SCOREBOARD_BASE_URL=https://site.api.espn.com/apis/site/v2/sports/soccer
ESPN_SCOREBOARD_DATE=20260612
```

Nunca colocar `SUPABASE_SERVICE_ROLE_KEY` ou `CRON_SECRET` com prefixo `NEXT_PUBLIC_` ou `EXPO_PUBLIC_`.

## Secrets do GitHub

No repositorio, configurar:

```env
ADMIN_SYNC_RESULTS_URL=https://SEU-ADMIN.vercel.app/api/admin/sync-results
CRON_SECRET=mesmo-valor-configurado-na-vercel
```

O workflow esta em `.github/workflows/sync-live-results.yml` e roda a cada 10 minutos. Tambem pode ser iniciado manualmente por `workflow_dispatch`.

## Como testar manualmente

Local com Admin rodando:

```powershell
curl.exe -X POST "http://localhost:3000/api/admin/sync-results" `
  -H "Authorization: Bearer SEU_CRON_SECRET" `
  -H "Content-Type: application/json"
```

Producao:

```powershell
curl.exe -X POST "https://SEU-ADMIN.vercel.app/api/admin/sync-results" `
  -H "Authorization: Bearer SEU_CRON_SECRET" `
  -H "Content-Type: application/json"
```

Sem token, o endpoint deve retornar `401`.

## Como usar o botao manual

No Admin, abrir `Partidas` e clicar em `Atualizar resultados agora`.

O painel mostra:

- jogos consultados
- jogos atualizados
- ao vivo
- encerrados
- palpites pontuados
- ranking atualizado
- classificacao atualizada
- mata-mata atualizado
- erros

## Como rodar simulacoes

```powershell
npm run simulate:auto-sync
```

O comando gera `AUTO_SYNC_VALIDATION_REPORT.md` com os 5 cenarios obrigatorios.

## Como validar ranking

1. Rode o sync manual.
2. Confira o resumo `Palpites pontuados` e `Ranking atualizado`.
3. Abra a aba `Ranking`.
4. Rode o sync novamente.
5. O ranking nao deve somar pontos duplicados; ele e recalculado por valores finais.

## Como pausar o cron

Opcoes:

- desabilitar o workflow `Sync Live Results` no GitHub Actions;
- remover temporariamente `ADMIN_SYNC_RESULTS_URL`;
- trocar/remover `CRON_SECRET` na Vercel e no GitHub.

## Como alterar frequencia

Editar `.github/workflows/sync-live-results.yml`:

```yaml
schedule:
  - cron: "*/10 * * * *"
```

Exemplos:

- `*/5 * * * *`: a cada 5 minutos
- `*/15 * * * *`: a cada 15 minutos
- `0 * * * *`: uma vez por hora

## Observacoes de seguranca

- O endpoint nao usa chave publica para escrever resultados.
- O service role fica somente no server-side do Admin.
- Provider vazio ou com erro nao apaga partidas.
- Mata-mata atualiza partidas existentes por `stats.match_number`; nao cria duplicatas.
- Pontuacao e ranking usam updates/upserts idempotentes.
