# Cleanup Demo Data Plan

## Regra

Todo dado de demonstracao deve ser removivel, rastreavel e separado de dados reais.

## Convencao

- Prefixo visual: `DEMO_USER_FLOW`.
- Emails: `demo-user-flow-*.demo.local`.
- Provider de partidas: `demo_user_flow`.
- Convite de liga: `DEMO-USER-FLOW`.

## Comandos

- `npm run cleanup:demo-user-flow:dry-run`: mostra o plano de limpeza.
- `npm run cleanup:demo-user-flow`: remove dados demo criados pelo seed.

## Ordem De Limpeza

1. Notificacoes demo.
2. Convites e membros de grupos demo.
3. Grupos demo.
4. Conquistas e rankings dos usuarios demo.
5. Partidas demo por provider.
6. Usuarios auth/public demo por prefixo de email.

## Protecao

O cleanup nao remove palpites porque `predictions` tem regra de bloqueio permanente. Por isso o seed tambem nao cria palpites reais.
