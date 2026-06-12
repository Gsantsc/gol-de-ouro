# Gol de Ouro - Deploy Separado

Objetivo: subir Admin, User e App como entregas separadas, usando o mesmo Supabase beta, sem um deploy alterar o comportamento do outro.

## 1. Admin Web

Projeto recomendado no Vercel: `gol-de-ouro-admin`

Configuracao:

- Repository: `Gsantsc/gol-de-ouro`
- Root Directory: `apps/admin`
- Framework Preset: `Next.js`
- Install Command: `npm install --prefix ../..`
- Build Command: `npm run build -w @gol-de-ouro/admin --prefix ../..`
- Output Directory: deixar vazio/default

Variaveis:

- `GOL_DE_OURO_ENTRY=admin`
- `NEXT_PUBLIC_GOL_DE_OURO_ENTRY=admin`
- `NEXT_PUBLIC_SUPABASE_URL=https://ducbujfguxyjqrjjvjxu.supabase.co`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xVYiaDfdL6rRkojrnaVgtw_FUWEytkj`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xVYiaDfdL6rRkojrnaVgtw_FUWEytkj`

URL principal:

- `/admin`

## 2. User Web

Projeto recomendado no Vercel: `gol-de-ouro-user`

Configuracao:

- Repository: `Gsantsc/gol-de-ouro`
- Root Directory: `apps/admin`
- Framework Preset: `Next.js`
- Install Command: `npm install --prefix ../..`
- Build Command: `npm run build -w @gol-de-ouro/admin --prefix ../..`
- Output Directory: deixar vazio/default

Variaveis:

- `GOL_DE_OURO_ENTRY=dashboard`
- `NEXT_PUBLIC_GOL_DE_OURO_ENTRY=dashboard`
- `NEXT_PUBLIC_SUPABASE_URL=https://ducbujfguxyjqrjjvjxu.supabase.co`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xVYiaDfdL6rRkojrnaVgtw_FUWEytkj`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xVYiaDfdL6rRkojrnaVgtw_FUWEytkj`

URL principal:

- `/dashboard`

Regra: se alguem tentar abrir `/admin` no projeto User, o proxy redireciona para `/dashboard`.

## 3. App Mobile

Build recomendado para beta fechado:

```bash
npm run mobile:check:beta-env
npm run mobile:build:apk
```

Build recomendado para Play Store:

```bash
npm run mobile:build:aab
```

Configuracao atual:

- Package Android: `br.com.goldeouro.app`
- EAS Project ID: `a8c8cf09-d06c-4823-a2a6-c0b4c2d75196`
- Ambiente: `beta`
- Supabase: `https://ducbujfguxyjqrjjvjxu.supabase.co`

## Build alternativo pela raiz do repo

Se o Vercel for configurado com Root Directory `./`, use:

Admin:

```bash
npm run vercel:admin
```

User:

```bash
npm run vercel:user
```

Nesse modo, o script copia `apps/admin/.next` para `.next` na raiz para o Vercel encontrar o output correto.

## Checklist antes do push

- `npm run validate:match-rules`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run mobile:check:beta-env`
- Conferir `git status` e nao commitar `supabase/.temp`.
- Nao commitar secrets de service role.
