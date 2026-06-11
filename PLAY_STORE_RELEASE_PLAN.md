# Plano de Release na Google Play - Gol de Ouro

## Status Atual
- ⏳ APK beta ainda não gerado
- ⏳ Testes em dispositivo não realizados
- ⏳ Configuração Google Play não iniciada

## Checklist Google Play

### 1. Conta Google Play Console
- [ ] Criar conta Google Play Console
- [ ] Pagar taxa de registro ($25 USD)
- [ ] Verificar identidade
- [ ] Configurar perfil de desenvolvedor

### 2. Informações do App
- [ ] **Nome do App**: Gol de Ouro
- [ ] **Descrição Curta**: Aposte nos jogos da Copa do Mundo e ganhe pontos!
- [ ] **Descrição Completa**: (a ser elaborada)
  - Funcionalidades principais
  - Como funciona
  - Benefícios
  - Requisitos
- [ ] **Categoria**: Esportes
- [ ] **Classificação Indicativa**: +12 (apostas esportivas)

### 3. Assets Visuais
- [ ] **Ícone 512x512**: PNG transparente
- [ ] **Feature Graphic**: 1024x500 PNG
- [ ] **Screenshots Mobile**:
  - [ ] Tela inicial/home
  - [ ] Tela de jogos/partidas
  - [ ] Tela de palpites
  - [ ] Tela de ranking
  - [ ] Tela de grupos
  - [ ] Tela de perfil
  - [ ] Mínimo 2, máximo 8 screenshots
- [ ] **Banner Promocional**: (opcional)

### 4. Política de Privacidade
- [ ] Criar política de privacidade
- [ ] Hospedar em URL pública
- [ ] Incluir link no Google Play Console
- [ ] Cobrir:
  - Coleta de dados
  - Uso de dados
  - Compartilhamento de dados
  - Segurança
  - Direitos do usuário
  - Contato

### 5. Declaração de Dados
- [ ] Preencher declaração de dados do Google Play
- [ ] Informar:
  - Coleta de dados (email, nome, etc.)
  - Finalidade (autenticação, personalização)
  - Compartilhamento (Supabase)
  - Segurança (criptografia)
  - Práticas de dados

### 6. Configuração Técnica
- [ ] **Package Name**: br.com.goldeouro.app
- [ ] **Version Code**: 1
- [ ] **Version Name**: 0.1.0
- [ ] **Min SDK**: Android 5.0 (API 21) ou superior
- [ ] **Target SDK**: Android 14 (API 34)
- [ ] **Assinatura**: Configurar keystore

### 7. Permissões
- [ ] INTERNET - Necessária para Supabase
- [ ] ACCESS_NETWORK_STATE - Verificar conectividade
- [ ] VIBRATE - Notificações (opcional)
- [ ] Justificar cada permissão

### 8. Conteúdo do App
- [ ] Validar que o app não contém:
  - Conteúdo ofensivo
  - Violência excessiva
  - Conteúdo sexual
  - Discurso de ódio
  - Conteúdo ilegal
- [ ] Garantir que o app é seguro
- [ ] Testar funcionalidades principais

### 9. Testes e QA
- [ ] Testar em múltiplos dispositivos
- [ ] Testar em diferentes versões Android
- [ ] Testar conectividade
- [ ] Testar fluxo de autenticação
- [ ] Testar funcionalidades principais
- [ ] Validar performance
- [ ] Verificar crashes

### 10. AAB (Android App Bundle)
- [ ] Gerar AAB usando perfil beta-store
- [ ] Testar AAB em dispositivo
- [ ] Validar tamanho do AAB
- [ ] Fazer upload no Google Play Console

### 11. Preço e Distribuição
- [ ] Definir preço: Gratuito
- [ ] Configurar distribuição:
  - [ ] Países disponíveis
  - [ ] Dispositivos elegíveis
  - [ ] Restrições de conteúdo

### 12. Review e Publicação
- [ ] Submeter para review
- [ ] Aguardar aprovação (2-7 dias)
- [ ] Corrigir problemas se rejeitado
- [ ] Publicar após aprovação

## Cronograma Estimado

### Fase 1: Preparação (1-2 semanas)
- Criar conta Google Play Console
- Elaborar descrições
- Criar assets visuais
- Escrever política de privacidade

### Fase 2: Configuração (1 semana)
- Configurar perfil de desenvolvedor
- Preencher declaração de dados
- Configurar assinatura
- Validar permissões

### Fase 3: Testes (1 semana)
- Testar APK beta em dispositivos
- Validar funcionalidades
- Corrigir bugs
- Gerar AAB final

### Fase 4: Submissão (1 dia)
- Fazer upload do AAB
- Preencher informações
- Submeter para review

### Fase 5: Review (2-7 dias)
- Aguardar review do Google
- Corrigir problemas se necessário
- Publicar após aprovação

## Pré-requisitos

### Antes de Submeter
- [ ] APK beta testado e validado
- [ ] Service role Supabase configurada
- [ ] Migrations aplicadas no Supabase produção
- [ ] Seed data criada no Supabase produção
- [ ] Admin produção criado
- [ ] Conectividade Supabase produção validada
- [ ] Todos os bugs críticos corrigidos
- [ ] Performance otimizada
- [ ] Segurança validada

## Riscos e Mitigações

### Risco 1: Rejeição por Conteúdo
**Mitigação**: Revisar políticas do Google Play antes de submeter

### Risco 2: Rejeição por Permissões
**Mitigação**: Justificar cada permissão claramente

### Risco 3: Rejeição por Política de Privacidade
**Mitigação**: Seguir template oficial e incluir todos os pontos obrigatórios

### Risco 4: Bugs em Produção
**Mitigação**: Testes extensivos em beta, rollback plan pronto

### Risco 5: Problemas de Conectividade
**Mitigação**: Validar Supabase produção, implementar retry logic

## Pós-Lançamento

### Monitoramento
- [ ] Configurar analytics (Firebase Analytics)
- [ ] Monitorar crashes (Firebase Crashlytics)
- [ ] Monitorar performance
- [ ] Monitorar feedback dos usuários

### Suporte
- [ ] Configurar canal de suporte
- [ ] Criar FAQ
- [ ] Preparar respostas para perguntas frequentes
- [ ] Monitorar reviews

### Atualizações
- [ ] Planejar roadmap de atualizações
- [ ] Coletar feedback dos usuários
- [ ] Priorizar bugs e features
- [ ] Release regular de atualizações

## Documentos Necessários

### Para Submissão
- Política de privacidade
- Declaração de dados
- Termos de serviço (opcional)
- Licenças de terceiros
- Informações de contato

### Para Desenvolvimento
- Documentação técnica
- Guia de deployment
- Plano de rollback
- Plano de incidentes

## Contatos

### Google Play Support
- Console: https://play.google.com/console
- Help Center: https://support.google.com/googleplay/android-developer
- Policy Center: https://play.google.com/about/developer-content-policy/

## Recursos

### Documentação Oficial
- [Google Play Console Help](https://support.google.com/googleplay/android-developer)
- [Android App Bundle](https://developer.android.com/guide/app-bundle)
- [Google Play Policy](https://play.google.com/about/developer-content-policy)

### Ferramentas
- [Android Studio](https://developer.android.com/studio)
- [Google Play Console](https://play.google.com/console)
- [Firebase](https://firebase.google.com)

## Notas Importantes

- O app deve seguir todas as políticas do Google Play
- A política de privacidade deve ser clara e transparente
- As permissões devem ser justificadas e necessárias
- O app deve ser seguro e não conter malware
- O conteúdo deve ser apropriado para a classificação indicativa
- O app deve funcionar corretamente em todos os dispositivos declarados
- O desenvolvedor é responsável por manter o app atualizado
