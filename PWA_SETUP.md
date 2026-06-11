# PWA Setup - Gol de Ouro

Status: PWA do usuario habilitado em `apps/mobile`.

## Produto

- Admin continua separado em `apps/admin`.
- Usuario usa o Web App/PWA em `apps/mobile`.
- APK/AAB ficam opcionais.

## Arquivos PWA

- `apps/mobile/public/manifest.json`
- `apps/mobile/public/service-worker.js`
- `apps/mobile/public/icons/icon-192.png`
- `apps/mobile/public/icons/icon-512.png`
- `apps/mobile/public/icons/maskable-512.png`
- `apps/mobile/public/icons/apple-touch-icon.png`
- `apps/mobile/src/pwa/registerServiceWorker.ts`
- `apps/mobile/src/components/InstallPwaPrompt.tsx`

## Como rodar local

```powershell
cd C:\Users\gbiel\gol-de-ouro
npm run mobile
```

Abra o endereco exibido pelo Expo.

## Como gerar build web

```powershell
cd C:\Users\gbiel\gol-de-ouro
npm run pwa:export
```

Saida esperada:

```text
apps/mobile/dist-pwa
```

## Cache seguro

O service worker cacheia somente shell e assets estaticos.

Nao cacheia:

- Supabase
- Auth
- Palpites
- Ranking
- Ligas
- Perfis
- Realtime

