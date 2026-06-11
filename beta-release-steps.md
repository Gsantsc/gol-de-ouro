# Como fechar as pendencias do beta

Data: 2026-06-07

Este guia separa o que ja foi preparado no projeto e o que voce precisa executar com suas contas/dispositivos.

## Parte 1 - Ja executado no projeto

Feito:

- Criado `apps/mobile/eas.json`.
- Criados scripts:
  - `npm run mobile:check:beta-env`
  - `npm run mobile:build:apk`
  - `npm run mobile:build:aab`
  - `npm run mobile:submit:beta`
- Configurado Android package:
  - `br.com.goldeouro.app`
- Criado bloqueio para nao gerar APK beta apontando para Supabase local.
- Validado:
  - `npm run typecheck -w @gol-de-ouro/mobile`
  - `npm audit --audit-level=high`
  - `npx expo config --json`

## Parte 2 - Supabase beta remoto

Status: URL e publishable key publicas ja configuradas para o mobile.

Configurado:

- `apps/mobile/.env`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Projeto beta:

```env
EXPO_PUBLIC_SUPABASE_URL=https://ducbujfguxyjqrjjvjxu.supabase.co
```

Validado:

```powershell
npm run mobile:check:beta-env
```

Resultado: `status: ok`.

Ainda falta para rodar seed/migrations no remoto:

- `SUPABASE_SERVICE_ROLE_KEY` do projeto beta.

Quando voce quiser validar banco remoto completo, atualize tambem:

No `.env` raiz:

```env
APP_ENV=beta
EXPO_PUBLIC_APP_ENV=beta
NEXT_PUBLIC_APP_ENV=beta
SUPABASE_URL=https://SEU-PROJETO-BETA.supabase.co
SUPABASE_ANON_KEY=SUA_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=SUA_SERVICE_ROLE_KEY
EXPO_PUBLIC_SUPABASE_URL=https://SEU-PROJETO-BETA.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=SUA_ANON_KEY
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO-BETA.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=SUA_ANON_KEY
NEXT_PUBLIC_APP_URL=https://beta.goldeouro.app
EXPO_ANDROID_PACKAGE=br.com.goldeouro.app
EXPO_ANDROID_VERSION_CODE=1
```

## Parte 3 - Instalar EAS CLI

O projeto nao instala `eas-cli` como dependencia porque ele traz vulnerabilidades de dev transitivas no `npm audit`.

Instale globalmente:

```powershell
npm install -g eas-cli
eas --version
eas login
```

## Parte 4 - Gerar APK beta interno

Use APK para testar com poucas pessoas fora da Play Store.

```powershell
cd C:\Users\gbiel\gol-de-ouro
npm run mobile:check:beta-env
npm run mobile:build:apk
```

Quando terminar, o EAS vai mostrar um link para baixar o APK.

Envie esse APK para testers confiaveis.

## Parte 5 - Testar no Android fisico

Se voce tiver o APK local e ADB instalado:

```powershell
adb install -r caminho\do\gol-de-ouro.apk
```

Checklist no celular:

- Cadastro novo
- Aprovar usuario no admin
- Login
- Home
- Jogos
- Palpite completo
- Primeiro jogador com Player Picker
- Homem do jogo com Player Picker
- Aba Palpites
- Ranking
- Ligas
- Convite
- Perfil
- Enviar feedback beta
- Logout/login novamente

## Parte 6 - Gerar AAB para Google Play

Use AAB para Play Console.

```powershell
cd C:\Users\gbiel\gol-de-ouro
npm run mobile:check:beta-env
npm run mobile:build:aab
```

Depois suba o AAB na Play Console em teste fechado.

## Parte 7 - Publicar no teste fechado da Play Store

Na Google Play Console:

1. Crie o app.
2. Va em Teste fechado.
3. Crie uma faixa de teste.
4. Adicione emails dos testers.
5. Suba o AAB gerado pelo EAS.
6. Envie para revisao.
7. Compartilhe o link de opt-in com os testers.

## Parte 8 - Gravar video do app

Com celular conectado:

```powershell
adb shell screenrecord /sdcard/gol-de-ouro-beta.mp4
adb pull /sdcard/gol-de-ouro-beta.mp4 C:\Users\gbiel\gol-de-ouro\artifacts\
```

Navegue por:

- Home
- Jogos
- Palpites
- Ranking
- Ligas
- Perfil
- Admin web

## Estado atual

Bloqueadores restantes:

- `eas` global ainda nao esta instalado na maquina.
- `SUPABASE_SERVICE_ROLE_KEY` beta ainda nao foi informada, entao migrations/seed remoto ainda nao foram executados.
- `NEXT_PUBLIC_APP_URL` ainda esta em `localhost`; trocar para `https://beta.goldeouro.app` quando o dominio estiver pronto.
