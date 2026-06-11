# Gol de Ouro - Consistencia de Dados

Data: 2026-06-05

## Linha de base

| Entidade | Quantidade |
| --- | ---: |
| Usuarios | 3 |
| Partidas | 104 |
| Palpites | 0 |
| Rankings | 3 |
| Ligas | 1 |
| Membros de liga | 1 |
| Conquistas | 8 |
| Notificacoes | 0 |

## Partidas

- Status persistidos: 104 `fechado`.
- Divergencias entre status persistido e engine: 0.
- Divergencias nas janelas 24h/1h: 0.
- Mexico x South Africa:
  - inicio: 2026-06-11 19:00 UTC
  - abertura: 2026-06-10 19:00 UTC
  - fechamento: 2026-06-11 18:00 UTC
  - provider: `wc2026`

## Ranking

Comparacao realizada por usuario entre:

- soma de `predictions.points`
- quantidade com pontos maiores que zero
- quantidade de placares exatos em partidas encerradas
- valores materializados em `rankings`

Resultado atual: 0 divergencias.

## Inconsistencias de apresentacao

- Home web limita acertos ao total de palpites para esconder dados impossiveis.
- Perfil web limita acertos e exatos com `Math.min`.
- Home mobile divide acertos por todos os palpites.
- Perfil mobile divide acertos apenas por palpites encerrados.
- Perfil web e mobile geram badges locais diferentes dos registros em `achievements`.

## Inconsistencias de persistencia

- `predictions` nao permite update do usuario.
- `notifications` nao recebe eventos automaticos.
- `achievements` pode desbloquear posicao sem participacao real.
- Provider pode encerrar uma partida sem acionar imediatamente toda a cadeia de pontuacao e ranking.

## Criterio para aprovacao

Uma rodada sera considerada consistente quando, para cada usuario:

1. `ranking.total_points` for igual a soma dos pontos de partidas encerradas.
2. `ranking.correct_results` for igual aos palpites pontuados de partidas encerradas.
3. `ranking.exact_scores` for igual aos placares exatos de partidas encerradas.
4. Home, Palpites, Ranking, Liga e Perfil exibirem os mesmos valores.
5. Conquistas vierem exclusivamente da tabela `achievements`.
6. Notificacoes forem criadas por eventos reais do fluxo.

## Resultado apos correcoes

- Palpite criado e editado via RLS enquanto aberto.
- Edicao apos fechamento rejeitada.
- Ranking recalculado automaticamente apos encerramento.
- Conquistas persistidas substituem badges locais.
- Notificacoes reais sao criadas para criacao, edicao e pontuacao.
- QA ponta a ponta aprovado em `artifacts/qa-user-flow-evidence.json`.
- Cleanup QA executado com sucesso depois da captura visual.
- Checagem independente confirmou: 0 usuarios QA, 0 partidas QA e 0 ligas QA restantes.
# Atualização - 2026-06-06

## Resultado Da Auditoria Atual

- `npx supabase db reset` executado com sucesso; migrations aplicam do zero.
- `players` foi ressemeado com 240 jogadores e 48 seleções no roster.
- `predictions` salva jogador por ID e mantém texto legado nulo.
- `groups` possui `invite_token`, `invite_url` e `invite_active`.
- `app_invites` possui tokens únicos e status controlado.
- QA validou que ranking, perfil, conquistas e ligas derivam de dados persistidos.

## Correções Recentes

- Saída do seed de jogadores corrigida: agora separa `rosterTeams` de `syncedTeams`.
- Links de convite deixaram de ser montados manualmente na UI e passaram a vir do banco.
- Entrada manual de link de convite foi removida das telas de produção.
