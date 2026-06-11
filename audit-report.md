# Gol de Ouro - Relatorio de Auditoria

Data da auditoria: 2026-06-05

## Escopo

Auditoria somente leitura realizada antes de qualquer correcao funcional, cobrindo:

- Home
- Jogos
- Palpites
- Ranking
- Ligas
- Perfil
- Web, mobile, Supabase e jobs locais

## Mapa da arquitetura

### Web

- Tela principal do usuario: `apps/admin/src/app/dashboard/page.tsx`
- Autenticacao e consultas: `apps/admin/src/lib/user-api.ts`
- Cliente Supabase: `apps/admin/src/lib/supabase.ts`
- Status de partidas: `apps/admin/src/lib/match-status-service.ts`
- Encerramento e ranking: `apps/admin/src/lib/ranking-update-service.ts`

### Mobile

- Orquestracao: `apps/mobile/src/screens/AppRoot.tsx`
- Cache, retry, realtime e polling: `apps/mobile/src/hooks/useFootballData.ts`
- Consultas e mutacoes: `apps/mobile/src/services/football.service.ts`
- Telas: `apps/mobile/src/screens`

### Compartilhado

- Status: `packages/shared/src/match-status-engine.ts`
- Janela de palpites: `packages/shared/src/prediction-window-service.ts`
- Pontuacao: `packages/shared/src/scoring-engine.ts`
- Tipos: `packages/shared/src/types.ts`

### Banco e automacao

- Schema e regras: `supabase/migrations`
- Job local idempotente: `scripts/jobs-matches.cjs`
- Validacao isolada: `scripts/validate-match-rules.cjs`
- Massa de demonstracao: `scripts/demo-user-flow.cjs`

Nao existe uma camada Repository separada. Web e mobile acessam Supabase por services locais.

## Fonte de dados por tela

| Tela | Fonte persistida | Derivacoes locais |
| --- | --- | --- |
| Home | matches, predictions, rankings, groups, notifications | proximo jogo, pendencias, taxa de acerto |
| Jogos | matches, predictions | filtros e permissao de palpitar |
| Palpites | predictions, matches | categorias e status visual |
| Ranking | rankings, nomes publicos, group_members | posicao e recortes por liga |
| Ligas | groups, group_members, rankings | ranking dos membros |
| Perfil | predictions, matches, rankings | taxa, streak, badges e evolucao |

## Estado real observado

- 3 usuarios
- 6 campeonatos
- 104 partidas
- 0 palpites
- 3 rankings
- 1 liga
- 1 membro de liga
- 8 registros de conquistas
- 0 notificacoes
- 9 migrations aplicadas

As 104 partidas possuem janelas 24h/1h coerentes e nenhum status divergente no momento da auditoria.

## Regras efetivamente aplicadas

### Palpites

- Um palpite por usuario e partida.
- Somente usuario aprovado pode inserir.
- Janela abre 24h antes e fecha 1h antes.
- Constraint `predictions_are_permanently_locked`.
- Trigger bloqueia alteracao de placar e exclusao.
- Nao existe policy RLS de update para o usuario.

### Pontuacao

- Placar exato: 5 pontos.
- Resultado correto: 3 pontos.
- Mesma diferenca de gols: 2 pontos.
- Zebra com resultado correto: +2 pontos.
- Placar exato 0x0: +1 ponto.
- Jogo dourado: multiplica o total por 2.

Primeiro jogador a marcar e homem do jogo nao possuem campos, UI ou regra de pontuacao implementados.

### Ranking

- Materializado em `rankings`.
- Total, acertos e placares exatos sao recalculados a partir de `predictions`.
- A instancia atual apresenta zero divergencias entre ranking persistido e dados derivados.

### Conquistas

- Existe tabela e funcao de avaliacao persistida.
- Mobile carrega conquistas, mas nao entrega os dados para a tela Perfil.
- Web nao consulta a tabela e cria badges localmente.
- A regra atual desbloqueou `Top 3 geral` para usuario sem palpites porque havia apenas tres rankings zerados.

### Notificacoes

- Existe tabela, consulta e realtime.
- Nao existe trigger ou service que crie notificacao ao enviar/editar palpite ou receber pontos.

## Bugs e riscos encontrados

### Criticos

1. O roteiro exige edicao enquanto a janela esta aberta, mas banco, RLS, web e mobile bloqueiam permanentemente.
2. Conquistas exibidas nao usam a mesma fonte persistida entre web, mobile e banco.
3. Nao ha producao automatica de notificacoes no fluxo de palpite.

### Altos

1. Taxa de acerto usa todos os palpites como denominador na Home, mas apenas partidas encerradas no Perfil mobile.
2. Web mascara inconsistencias de ranking usando `Math.min` em acertos e placares exatos.
3. A troca automatica de status depende de job/API externo; nao existe agendamento persistido no banco.
4. Atualizacao de partida pelo provider para `encerrado` nao garante pontuacao sem execucao posterior do job.

### Medios

1. XP e campeonatos ganhos sao valores derivados visualmente, sem fonte persistida.
2. Ranking de liga usa pontos globais, inclusive de outros campeonatos.
3. Criterios de desempate nao estao centralizados em um unico helper.
4. Existem textos antigos afirmando que o palpite fica travado imediatamente.

## Resultado da fase Observe

O app possui uma base funcional consistente para partidas e ranking, mas ainda nao pode ser aprovado para release porque persistencia editavel, conquistas, notificacoes e metricas de perfil nao formam uma unica cadeia de dados.

