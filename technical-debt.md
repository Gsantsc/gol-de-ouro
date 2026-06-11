# Technical Debt

## Débitos Encontrados

- Arquivos grandes: `apps/admin/src/app/admin/page.tsx` e `apps/admin/src/app/dashboard/page.tsx` acumulam muita responsabilidade.
- Tokens existem, mas ainda há valores visuais diretos em Tailwind, CSS e React Native.
- O mobile mantém cópia local de shared/tokens porque o Metro não está configurado para consumir raiz/workspace com segurança.
- Há logs e artefatos antigos na raiz que não fazem parte do produto final.
- O Next ainda alerta que `middleware` deve migrar para `proxy`.

## Prioridade

1. Extrair componentes admin por domínio.
2. Consolidar DS web/mobile sem quebrar Expo.
3. Migrar `middleware` para `proxy` quando for uma tarefa técnica isolada.
4. Revisar artefatos antigos e decidir o que vira documentação oficial.

## Fora do Escopo Desta Rodada

- Alterar autenticação.
- Alterar fluxo de aprovação.
- Alterar provider WC2026.
- Alterar schema sem necessidade.
- Mudar regras de pontuação/palpite.
