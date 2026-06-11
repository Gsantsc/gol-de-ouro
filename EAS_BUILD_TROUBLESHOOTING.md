# Troubleshooting de Build EAS - Gol de Ouro

## Erros Comuns e Soluções

### 1. EPERM: operation not permitted, rmdir

#### Sintoma
```
Failed to upload the project tarball to EAS Build
Reason: EPERM: operation not permitted, rmdir 'C:\Users\gbiel\eas-tmp-gol-de-ouro\eas-cli-nodejs\...\shallow-clone\.vscode'
```

#### Causa
Limitação do Windows com permissões de diretório temporário do EAS CLI. O EAS CLI tenta limpar diretórios temporários mas não tem permissão no Windows.

#### Soluções

**Opção 1: GitHub Actions (Recomendado)**
```bash
# Usar workflow do GitHub Actions
# .github/workflows/mobile-android-beta-apk.yml
```

**Opção 2: WSL (Windows Subsystem for Linux)**
```bash
wsl
cd /mnt/c/Users/gbiel/gol-de-ouro
npm run mobile:build:apk
```

**Opção 3: Docker**
```bash
docker run --rm -v $(pwd):/app -w /app node:20 npm run mobile:build:apk
```

**Opção 4: Linux/Mac**
Executar o build em um ambiente Linux ou Mac.

#### Nota
Não insistir infinitamente no Windows. O problema é conhecido e não tem solução simples no Windows nativo.

---

### 2. Not logged in

#### Sintoma
```
Error: Not logged in. Run `eas login` first.
```

#### Causa
Usuário não está autenticado no EAS CLI.

#### Solução
```bash
eas login
```

#### Validação
```bash
eas whoami
```

---

### 3. Invalid environment

#### Sintoma
```
Error: Invalid environment configuration
```

#### Causa
Variáveis de ambiente incorretas ou ausentes.

#### Solução
```bash
# Validar environment
npm run mobile:check:beta-env

# Verificar .env do mobile
cat apps/mobile/.env
```

#### Variáveis Obrigatórias
- `EXPO_PUBLIC_APP_ENV`: beta
- `EXPO_PUBLIC_SUPABASE_URL`: https://ducbujfguxyjqrjjvjxu.supabase.co
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`: sb_publishable_xVYiaDfdL6rRkojrnaVgtw_FUWEytkj
- `EXPO_ANDROID_PACKAGE`: br.com.goldeouro.app
- `EXPO_ANDROID_VERSION_CODE`: 1
- `EXPO_EAS_PROJECT_ID`: a8c8cf09-d06c-4823-a2a6-c0b4c2d75196

---

### 4. Project ID mismatch

#### Sintoma
```
Error: Project ID mismatch
```

#### Causa
EXPO_EAS_PROJECT_ID inconsistente entre .env e eas.json.

#### Solução
```bash
# Verificar .env
grep EXPO_EAS_PROJECT_ID apps/mobile/.env

# Verificar eas.json
cat apps/mobile/eas.json

# Garantir que ambos tenham o mesmo valor
# a8c8cf09-d06c-4823-a2a6-c0b4c2d75196
```

---

### 5. Inconsistent filename casing

#### Sintoma
```
Detected inconsistent filename casing between your local filesystem and git
```

#### Causa
Git core.ignorecase está true e o repositório não foi inicializado corretamente.

#### Solução
```bash
# Verificar configuração
git config core.ignorecase

# Se necessário, inicializar git corretamente
git add .
git commit -m "Initial commit"
```

---

### 6. Missing dependencies

#### Sintoma
```
Error: Cannot find module '...'
```

#### Causa
Dependências não instaladas.

#### Solução
```bash
# Instalar dependências
npm install

# Limpar cache e reinstalar
rm -rf node_modules package-lock.json
npm install
```

---

### 7. Build timeout

#### Sintoma
```
Error: Build timeout
```

#### Causa
Build demorou mais que o tempo limite do EAS.

#### Solução
- Otimizar código
- Reduzir tamanho do bundle
- Aumentar timeout no eas.json (se possível)
- Verificar se há loops infinitos

---

### 8. Keystore issues

#### Sintoma
```
Error: Keystore not found or invalid
```

#### Causa
Keystore não configurado ou inválido.

#### Solução
```bash
# Gerar novo keystore
eas build:configure

# Ou usar keystore existente
# Configurar no EAS Console
```

---

### 9. Version code conflict

#### Sintoma
```
Error: Version code already exists
```

#### Causa
Version code já foi usado em um build anterior.

#### Solução
```bash
# Incrementar version code
# Editar apps/mobile/.env
EXPO_ANDROID_VERSION_CODE=2

# Ou no eas.json
"EXPO_ANDROID_VERSION_CODE": "2"
```

---

### 10. Network issues

#### Sintoma
```
Error: Failed to upload to EAS Build
Error: Failed to download build
```

#### Causa
Problemas de conectividade.

#### Solução
```bash
# Verificar conexão
ping expo.dev

# Verificar proxy
# Configurar proxy se necessário
export HTTP_PROXY=http://proxy:port
export HTTPS_PROXY=http://proxy:port
```

---

## Debugging Tips

### Verbose Mode
```bash
eas build --platform android --profile beta-apk --verbose
```

### Check EAS Status
```bash
eas build:list
```

### View Build Logs
```bash
eas build:view [BUILD_ID]
```

### Clear EAS Cache
```bash
rm -rf ~/.eas
```

### Clear Node Modules
```bash
rm -rf node_modules package-lock.json
npm install
```

### Clear Expo Cache
```bash
npx expo start --clear
```

---

## GitHub Actions Troubleshooting

### Workflow Fails

#### Verificar Secrets
```bash
# No GitHub, verificar se secrets estão configurados:
# - EAS_TOKEN
# - EXPO_PUBLIC_APP_ENV
# - EXPO_PUBLIC_SUPABASE_URL
# - EXPO_PUBLIC_SUPABASE_ANON_KEY
```

#### Verificar Workflow
```bash
# Verificar sintaxe do YAML
# Verificar se o arquivo está em .github/workflows/
```

#### Verificar Logs
```bash
# No GitHub Actions, ver os logs do workflow
# Identificar onde falhou
```

---

## Supabase Issues

### Connection Refused
```bash
# Verificar URL do Supabase
curl https://ducbujfguxyjqrjjvjxu.supabase.co

# Verificar se o Supabase está online
# No painel do Supabase
```

### Permission Denied
```bash
# Verificar se está usando anon key, não service role
# Service role não deve ser usada no app mobile
```

### Table Does Not Exist
```bash
# Verificar se migrations foram aplicadas
# No painel do Supabase, verificar se tabelas existem
```

---

## Prevenção

### Best Practices

1. **Sempre validar environment antes do build**
   ```bash
   npm run mobile:check:beta-env
   ```

2. **Usar GitHub Actions para builds de produção**
   - Evita problemas do Windows
   - Reproducível
   - Automatizado

3. **Manter dependências atualizadas**
   ```bash
   npm outdated
   npm update
   ```

4. **Testar localmente antes do build**
   ```bash
   npm run mobile
   ```

5. **Versionar corretamente**
   - Incrementar version code a cada build
   - Manter version name consistente

6. **Documentar mudanças**
   - Changelog
   - Release notes

---

## Recursos

### Documentação Oficial
- [EAS Build Docs](https://docs.expo.dev/build/introduction/)
- [EAS CLI Reference](https://docs.expo.dev/eas-cli/)
- [Troubleshooting EAS](https://docs.expo.dev/build/troubleshooting/)

### Comunidade
- [Expo Forums](https://forums.expo.dev/)
- [GitHub Issues](https://github.com/expo/eas-cli/issues)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/expo)

### Suporte
- [Expo Support](https://expo.dev/support)
- [EAS Status](https://status.expo.dev/)

---

## Checklist Antes do Build

- [ ] EAS login realizado
- [ ] Environment validado
- [ ] Git commit realizado
- [ ] Dependências instaladas
- [ ] Version code incrementado
- [ ] Supabase acessível
- [ ] Código testado localmente
- [ ] Lint passando
- [ ] Typecheck passando
- [ ] Build local funcionando (se possível)

---

## Contato

Se nenhum dos passos acima resolver:
1. Verificar logs detalhados
2. Pesquisar no Google/Stack Overflow
3. Abrir issue no GitHub do projeto
4. Contatar suporte do Expo
