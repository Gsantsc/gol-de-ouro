# Deploy do Admin na Vercel

Use este fluxo para criar um projeto Vercel novo e limpo para o painel admin.

## Projeto

- Repository: `Gsantsc/gol-de-ouro`
- Project name: `gol-de-ouro-admin`
- Root Directory: `apps/admin`

O arquivo `apps/admin/vercel.json` ja define:

- Framework: `nextjs`
- Install Command: `npm install --prefix ../..`
- Build Command: `npm run build -w @gol-de-ouro/admin --prefix ../..`

## Variaveis de ambiente

Adicione em Production:

```txt
GOL_DE_OURO_ENTRY=admin
NEXT_PUBLIC_APP_ENV=beta
NEXT_PUBLIC_SUPABASE_URL=https://ducbujfguxyjqrjjvjxu.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=cole_a_chave_publicavel_do_supabase
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=cole_a_chave_publicavel_do_supabase
```

## Importante

- Nao configure Output Directory.
- Se a Vercel mostrar Output Directory como `public`, apague ou desligue o override.
- Nao use `apps/mobile/dist-pwa` no projeto admin.

## Validacao

Depois do deploy ficar Ready, abra:

```txt
https://seu-projeto.vercel.app/admin
```
