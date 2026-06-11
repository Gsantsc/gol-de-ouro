# Checklist de QA Beta - Gol de Ouro

## Status Atual
- ⏳ APK beta ainda não gerado
- ⏳ Testes em dispositivo não realizados
- ⏳ Validação de funcionalidades não iniciada

## Pré-requisitos para QA

### Antes de Instalar o APK
- [ ] APK beta gerado com sucesso
- [ ] APK baixado do GitHub Actions ou EAS
- [ ] Dispositivo Android disponível
- [ ] Versão Android 5.0+ (API 21+)
- [ ] Conectividade internet disponível
- [ ] Supabase beta acessível

## Instalação do APK

### Passos de Instalação
1. Baixar APK do link fornecido
2. Permitir instalação de fontes desconhecidas nas configurações do Android
3. Abrir o arquivo APK
4. Seguir instruções de instalação
5. Concluir instalação

### Validação de Instalação
- [ ] APK instalado com sucesso
- [ ] Ícone do Gol de Ouro aparece na home
- [ ] App abre sem crashes
- [ ] Permissões solicitadas corretamente
- [ ] App não consome bateria excessivamente em idle

## Testes Funcionais

### 1. Autenticação

#### Cadastro
- [ ] Tela de cadastro acessível
- [ ] Validação de email funciona
- [ ] Validação de senha funciona
- [ ] Cadastro completado com sucesso
- [ ] Usuário criado no Supabase
- [ ] Status inicial: pending
- [ ] Redirecionamento para tela de aprovação

#### Login
- [ ] Tela de login acessível
- [ ] Login com email/senha funciona
- [ ] Login com credenciais inválidas falha corretamente
- [ ] Recuperação de senha funciona (se implementado)
- [ ] Sessão mantida após fechar app
- [ ] Logout funciona corretamente

#### Aprovação
- [ ] Tela de aprovação aparece para usuários pending
- [ ] Mensagem de aguardando aprovação clara
- [ ] Usuário aprovado pode acessar app completo
- [ ] Usuário rejeitado não pode acessar
- [ ] Admin pode aprovar/rejeitar usuários

### 2. Home / Dashboard

#### Carregamento
- [ ] Home carrega sem erros
- [ ] Loading state aparece durante carregamento
- [ ] Dados exibidos corretamente
- [ ] Refresh manual funciona
- [ ] Auto-refresh funciona (se implementado)

#### Conteúdo
- [ ] Partidas exibidas corretamente
- [ ] Campeonatos exibidos corretamente
- [ ] Ranking exibido corretamente
- [ ] Grupos exibidos corretamente
- [ ] Informações atualizadas

### 3. Partidas / Jogos

#### Listagem
- [ ] Lista de partidas carrega
- [ ] Filtros funcionam (se implementados)
- [ ] Busca funciona (se implementado)
- [ ] Ordenação correta
- [ ] Detalhes da partida visíveis

#### Detalhes
- [ ] Detalhes da partida carregam
- [ ] Times exibidos corretamente
- [ ] Horário exibido corretamente
- [ ] Status exibido corretamente
- [ ] Logos dos times carregam (se disponíveis)

### 4. Palpites

#### Criação de Palpite
- [ ] Tela de palpite acessível
- [ ] Campos de palpite funcionam
- [ ] Validação funciona
- [ ] Palpite salvo com sucesso
- [ ] Palpite aparece na lista
- [ ] Palpite não pode ser editado após janela fechada

#### Lista de Palpites
- [ ] Lista de palpites carrega
- [ ] Palpites exibidos corretamente
- [ ] Status do palpite visível
- [ ] Pontuação calculada corretamente
- [ ] Histórico de palpites acessível

### 5. Ranking

#### Exibição
- [ ] Ranking carrega sem erros
- [ ] Posição correta exibida
- [ ] Pontuação correta exibida
- [ ] Lista de usuários ordenada
- [ ] Detalhes do ranking acessíveis

#### Filtros
- [ ] Filtros funcionam (se implementados)
- [ ] Filtro por campeonato funciona
- [ ] Filtro por período funciona (se implementado)

### 6. Grupos

#### Criação de Grupo
- [ ] Tela de criação acessível
- [ ] Nome do grupo pode ser definido
- [ ] Grupo criado com sucesso
- [ ] Código de convite gerado
- [ ] Usuário é dono do grupo

#### Convites
- [ ] Código de convite funciona
- [ ] Convite pode ser compartilhado
- [ ] Usuário pode entrar por convite
- [ ] Validação de convite funciona
- [ ] Convites expiram corretamente (se implementado)

#### Gestão de Grupo
- [ ] Lista de membros carrega
- [ ] Dono pode remover membros
- [ ] Dono pode fechar grupo
- [ ] Membros podem sair
- [ ] Ranking do grupo funciona

### 7. Perfil

#### Exibição
- [ ] Perfil carrega sem erros
- [ ] Nome exibido corretamente
- [ ] Email exibido corretamente
- [ ] Estatísticas visíveis
- [ ] Histórico acessível

#### Edição
- [ ] Perfil pode ser editado (se implementado)
- [ ] Foto de perfil pode ser alterada (se implementado)
- [ ] Alterações salvas corretamente

### 8. Navegação

#### Menu
- [ ] Menu de navegação acessível
- [ ] Todas as abas funcionam
- [ ] Navegação fluida
- [ ] Back button funciona
- [ ] Deep links funcionam (se implementados)

#### Performance
- [ ] Transições são suaves
- [ ] Carregamento é rápido
- [ ] Não há travamentos
- [ ] Memória não cresce indefinidamente

## Testes de Conectividade

### Online
- [ ] App funciona com internet
- [ ] Dados sincronizam
- [ ] Real-time funciona (se implementado)
- [ ] Push notifications funcionam (se implementados)

### Offline
- [ ] App lida com offline gracefulmente
- [ ] Dados em cache funcionam
- [ ] Mensagem de erro clara
- [ ] Requisita reconexão

### Conexão Lenta
- [ ] App funciona com conexão lenta
- [ ] Loading states aparecem
- [ ] Timeout funciona
- [ ] Não há travamentos

## Testes de UI/UX

### Design
- [ ] Design consistente
- [ ] Cores corretas
- [ ] Tipografia legível
- [ ] Ícones corretos
- [ ] Layout responsivo

### Usabilidade
- [ ] Interface intuitiva
- [ ] Botões acessíveis
- [ ] Formulários fáceis de preencher
- [ ] Mensagens de erro claras
- [ ] Feedback visual adequado

### Acessibilidade
- [ ] Tamanho de texto adequado
- [ ] Contraste suficiente
- [ ] Touch targets adequados
- [ ] Suporte a leitor de tela (se implementado)

## Testes de Segurança

### Autenticação
- [ ] Senhas não são exibidas
- [ ] Sessão expira corretamente
- [ ] Token refresh funciona
- [ ] Logout revoga acesso

### Dados
- [ ] Dados sensíveis não expostos
- [ ] Service role não usada no app
- [ ] RLS policies funcionam
- [ ] Dados em cache seguros

### Permissões
- [ ] Permissões mínimas solicitadas
- [ ] Permissões justificadas
- [ ] Permissões podem ser revogadas

## Testes de Performance

### Carregamento
- [ ] Cold start < 3 segundos
- [ ] Hot start < 1 segundo
- [ ] Navegação entre telas < 500ms
- [ ] Carregamento de dados < 2 segundos

### Uso de Recursos
- [ ] CPU < 30% em idle
- [ ] Memória < 150MB
- [ ] Bateria aceitável
- [ ] Tamanho do APK aceitável

## Testes de Compatibilidade

### Dispositivos
- [ ] Funciona em Android 5.0+
- [ ] Funciona em diferentes tamanhos de tela
- [ ] Funciona em diferentes densidades
- [ ] Funciona em tablets (se suportado)

### Orientação
- [ ] Funciona em portrait
- [ ] Funciona em landscape (se suportado)
- [ ] Rotação funciona corretamente

## Bugs Encontrados

### Críticos
- [ ] App crash ao abrir
- [ ] App crash ao fazer login
- [ ] App crash ao salvar palpite
- [ ] Dados não salvam
- [ ] Autenticação não funciona

### Importantes
- [ ] UI quebrada em algum dispositivo
- [ ] Funcionalidade não funciona
- [ ] Performance ruim
- [ ] Dados incorretos
- [ ] Navegação quebrada

### Menores
- [ ] Pequenos bugs visuais
- [ ] Texto incorreto
- [ ] Ícone incorreto
- [ ] Melhorias de UX

## Relatório Final

### Resumo
- **Data do Teste**: ___/___/____
- **Versão do APK**: 0.1.0
- **Dispositivo**: ___
- **Versão Android**: ___
- **Tester**: ___

### Status
- **Testes Passados**: ___/___
- **Testes Falhados**: ___/___
- **Bugs Críticos**: ___
- **Bugs Importantes**: ___
- **Bugs Menores**: ___

### Recomendação
- [ ] Aprovar para release
- [ ] Rejeitar para correções
- [ ] Aprovar com ressalvas

### Próximos Passos
1. ___
2. ___
3. ___

## Assinaturas

**Tester**: _________________ **Data**: ___/___/____

**Aprovador**: _________________ **Data**: ___/___/____
