# PWA Deploy Guide - Gol de Ouro

## Melhor opcao inicial

Vercel e a opcao mais simples para beta web.

Configuracao:

- Root/build command: `npm run pwa:export`
- Output directory: `apps/mobile/dist-pwa`
- Node.js: 20+

## Vercel

1. Conecte o repositorio.
2. Configure as variaveis publicas:
   - `EXPO_PUBLIC_APP_ENV=beta`
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
3. Build command:

```bash
npm run pwa:export
```

4. Output directory:

```text
apps/mobile/dist-pwa
```

## Cloudflare Pages

Configuracao:

- Framework: none/custom
- Build command: `npm run pwa:export`
- Build output: `apps/mobile/dist-pwa`
- Node version: 20

## Netlify

Configuracao:

- Build command: `npm run pwa:export`
- Publish directory: `apps/mobile/dist-pwa`

## Dominios recomendados

- Beta: `https://beta.goldeouro.app`
- Producao: `https://app.goldeouro.app`

## Importante

Nao use `SUPABASE_SERVICE_ROLE_KEY` no deploy do PWA.

