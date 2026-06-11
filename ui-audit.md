# UI Audit

## Diagnóstico

- A identidade premium já aponta para preto, dourado e azul, mas a implementação ainda mistura tokens com valores diretos em CSS/Tailwind/React Native.
- A navegação web usa estados ativos funcionais, porém pouco diferenciados para um produto esportivo de competição.
- Os cards de partidas melhoraram em relação ao MVP, mas ainda podem ficar mais densos e rápidos de escanear no web.
- O mobile possui base visual consistente, mas alguns estados de toque, foco visual e superfícies ainda dependem de `rgba` espalhado.
- Tabelas e painéis admin estão funcionais, mas precisam manter ritmo visual mais SaaS: cabeçalhos fortes, filtros compactos e status claros.

## Problemas Prioritários

- Hardcodes visuais espalhados dificultam manutenção da marca.
- Estados ativos de tabs não têm assinatura visual forte o suficiente.
- Alguns cards e blocos usam espaçamentos locais que competem com o design system.
- Estados de foco web precisam ser mais visíveis para teclado.
- Alguns elementos de ranking e partidas ainda parecem listas genéricas, não produto esportivo premium.

## Ações Aplicadas Nesta Rodada

- Consolidar tokens oficiais em `colors.ts` e alinhar Tailwind à paleta oficial.
- Adicionar variáveis CSS globais para cor, superfície, borda e foco.
- Melhorar navegação web com classe reutilizável de tab premium.
- Refinar card de partida web para mais densidade e leitura rápida.
- Reduzir hardcodes críticos em componentes mobile compartilhados.
