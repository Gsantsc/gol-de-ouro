# Checklist Beta 1.0 - Gol de Ouro

## Fluxos críticos

- [x] Cadastro não foi removido.
- [x] Login mantém bloqueio de duplo submit.
- [x] Aprovação manual continua obrigatória.
- [x] Usuário pending/rejected/suspended segue bloqueado.
- [x] Tela pending possui verificação manual, sem polling agressivo.

## Regras de palpites

- [x] `prediction_lock_minutes` persistido em `app_settings`.
- [x] Valores permitidos: 60, 90, 120 e 180 minutos.
- [x] Padrão: 60 minutos.
- [x] Admin altera a regra em Configurações do Bolão.
- [x] PWA e Mobile leem a regra do banco.
- [x] Criação/edição de palpite passam por RPC server-side.
- [x] Triggers bloqueiam palpite após o deadline configurado.
- [x] Visualização de palpites continua permitida.

## Segurança

- [x] RLS adicionada para `app_settings`.
- [x] Usuário não vê palpites de terceiros antes do fechamento configurado.
- [x] Usuário não altera palpite após bloqueio configurado.
- [x] Pontuação e ranking continuam server-side.
- [x] Service role continua restrita a rotas/server/scripts.
- [x] Nenhum secret novo foi exposto.

## UX e responsividade

- [x] Home premium no PWA com hero, próximos jogos, top 10, estatísticas, como funciona e CTA.
- [x] Últimos resultados, partidas ao vivo e badges adicionados na Home.
- [x] Mensagem de bloqueio: "Palpites encerrados para esta partida."
- [x] CSS global reduz overflow horizontal.
- [x] Modais/tabelas mantêm scroll e largura máxima.

## Validação automática

- [x] `npm run typecheck`
- [x] `npm run beta:check`

## Validação manual recomendada antes do redeploy

- [ ] Login com usuário aprovado.
- [ ] Login com usuário pending.
- [ ] Login com usuário rejected/suspended.
- [ ] Criar palpite com janela aberta.
- [ ] Editar palpite com janela aberta.
- [ ] Tentar criar/editar palpite dentro do bloqueio.
- [ ] Alterar regra no Admin para 90/120/180 e conferir PWA.
- [ ] Conferir Home em 320, 375, 390, 414, 768, 1024, 1366 e 1920 px.
