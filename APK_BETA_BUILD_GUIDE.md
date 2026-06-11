# Guia de Build do APK Beta - Gol de Ouro

## Status Atual
- ✅ EAS Login validado (gsantsc / gbieldev@hotmail.com)
- ✅ Configuração EAS validada (app.config.ts)
- ✅ eas.json configurado com perfis beta-apk, beta-apk-local, beta-store
- ✅ Environment beta validado (mobile:check:beta-env)
- ✅ Supabase beta remoto acessível
- ❌ Build local no Windows falha com EPERM (limitação conhecida)
- ✅ GitHub Actions configurado como fallback

## Configuração Validada

### EAS Project
- **Project ID**: a8c8cf09-d06c-4823-a2a6-c0b4c2d75196
- **Slug**: gol-de-ouro
- **Name**: Gol de Ouro
- **Package**: br.com.goldeouro.app
- **Version**: 0.1.0
- **Version Code**: 1

### Supabase Beta
- **URL**: https://ducbujfguxyjqrjjvjxu.supabase.co
- **Publishable Key**: sb_publishable_xVYiaDfdL6rRkojrnaVgtw_FUWEytkj
- **Environment**: beta

## Métodos de Build

### Método 1: GitHub Actions (Recomendado)
```bash
# Configurar secrets no GitHub:
# - EAS_TOKEN
# - EXPO_PUBLIC_APP_ENV
# - EXPO_PUBLIC_SUPABASE_URL
# - EXPO_PUBLIC_SUPABASE_ANON_KEY

# Disparar workflow manualmente:
# Vá em Actions > Build Android APK Beta > Run workflow

# Ou fazer push para master:
git push origin master
```

### Método 2: EAS Cloud (Windows - Limitado)
```bash
npm run mobile:build:apk
```
**Nota**: Pode falhar no Windows com erro EPERM devido a permissões de diretório temporário.

### Método 3: WSL (Windows Subsystem for Linux)
```bash
wsl
cd /mnt/c/Users/gbiel/gol-de-ouro
npm run mobile:build:apk
```

### Método 4: Docker
```bash
docker run --rm -v $(pwd):/app -w /app node:20 npm run mobile:build:apk
```

## Pré-requisitos

### Para GitHub Actions
1. Repositório no GitHub
2. Secrets configuradas:
   - `EAS_TOKEN`: Token do Expo
   - `EXPO_PUBLIC_APP_ENV`: beta
   - `EXPO_PUBLIC_SUPABASE_URL`: https://ducbujfguxyjqrjjvjxu.supabase.co
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`: sb_publishable_xVYiaDfdL6rRkojrnaVgtw_FUWEytkj

### Para Build Local
1. Node.js 20+
2. EAS CLI instalado: `npm install -g eas-cli`
3. Login no EAS: `eas login`
4. Git inicializado com commits

## Perfis de Build

### beta-apk
- **Tipo**: APK
- **Distribuição**: Internal
- **Ambiente**: beta
- **Uso**: Teste beta interno

### beta-apk-local
- **Tipo**: APK
- **Distribuição**: Internal
- **Ambiente**: beta
- **Uso**: Build local (não suportado no Windows)

### beta-store
- **Tipo**: App Bundle (AAB)
- **Distribuição**: Store
- **Ambiente**: beta
- **Uso**: Preparação para Google Play

## Solução de Problemas

### Erro: EPERM operation not permitted
**Causa**: Limitação do Windows com diretórios temporários do EAS CLI
**Solução**: Usar GitHub Actions, WSL, ou Docker

### Erro: Not logged in
**Solução**: `eas login`

### Erro: Invalid environment
**Solução**: Verificar `npm run mobile:check:beta-env`

### Erro: Project ID mismatch
**Solução**: Verificar EXPO_EAS_PROJECT_ID no .env e eas.json

## Próximos Passos

1. Configurar secrets no GitHub
2. Testar workflow do GitHub Actions
3. Baixar APK gerado
4. Instalar em dispositivo físico
5. Validar funcionalidades
6. Preparar AAB para Google Play

## Checklist de Validação

- [ ] EAS login realizado
- [ ] Environment beta validado
- [ ] Supabase beta acessível
- [ ] GitHub Actions configurado
- [ ] Secrets do GitHub configuradas
- [ ] Workflow testado
- [ ] APK gerado com sucesso
- [ ] APK instalado em dispositivo
- [ ] Funcionalidades validadas
