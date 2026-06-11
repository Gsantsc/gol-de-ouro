# Gol de Ouro - beta fechado readiness

Data: 2026-06-06

## Status geral

Go para beta fechado local/controlado.

## O que foi limpo

- `npm run cleanup:demo-user-flow` executado.
- Remocoes demo: 0, porque o banco ja estava limpo.
- Massa QA do teste automatizado foi criada e removida pelo script.
- Usuario temporario do teste de feedback foi removido.

## O que foi preparado

- Ambiente local marcado como beta:
  - `APP_ENV=beta`
  - `EXPO_PUBLIC_APP_ENV=beta`
  - `NEXT_PUBLIC_APP_ENV=beta`
- `.env.example` documenta as mesmas flags.
- `app_feedback` criado com RLS.
- Perfil mobile envia feedback beta persistente.
- Admin carrega fila de feedback beta no Dashboard.
- Screenshot visual salvo em `artifacts/admin-beta-login.png`.

## Validacoes executadas

- `npm audit --audit-level=high`
- `npm run cleanup:demo-user-flow:dry-run`
- `npm run cleanup:demo-user-flow`
- `npm run typecheck -w @gol-de-ouro/shared`
- `npm run typecheck -w @gol-de-ouro/mobile`
- `npm run typecheck -w @gol-de-ouro/admin`
- `npm run lint`
- `npm run validate:match-rules`
- `npm run seed:players:wc2026:dry-run`
- `npm run qa:user-flow`
- `npm run build`
- `npx expo export --platform web --output-dir dist-beta-validation`
- Healthcheck local de `/admin`

## Go/No-Go

- Go: app limpo de demo/QA.
- Go: zero vulnerabilidades high/critical no audit.
- Go: fluxo principal validado.
- Go: feedback beta persistente.
- Go: admin e mobile passam em typecheck/build.
- No-Go parcial: APK beta ainda nao foi gerado nesta maquina.
- No-Go parcial: video de navegacao nao foi gerado nesta rodada.
- Go: Supabase mobile aponta para o projeto beta remoto e passou em `mobile:check:beta-env`.
- No-Go parcial: service role beta ainda nao foi informada para migrations/seed remoto.
- No-Go parcial: EAS CLI global ainda nao esta instalado na maquina.

## Guia operacional

Ver `beta-release-steps.md`.
