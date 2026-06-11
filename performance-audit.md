# Performance Audit

## Diagnóstico

- O app usa `useMemo`, `useCallback` e `memo` em áreas importantes, como filtros e cards de partida mobile.
- O admin e o dashboard web ainda concentram muitos componentes no mesmo arquivo, o que aumenta custo de leitura e manutenção.
- Realtime com fallback polling no admin é funcional, mas pode causar refreshes redundantes se o volume crescer.
- O mobile usa listas simples; para volume maior de partidas/ranking, FlatList/SectionList deve substituir mapas diretos.

## Melhorias Aplicadas Nesta Rodada

- Mantida a lógica de negócio intacta e ajustes focados em classes/tokens para baixo risco.
- Reduzida duplicação visual em navegação web.
- Reforçada densidade dos cards para reduzir scroll e melhorar leitura.

## Recomendações

- Extrair painéis grandes do admin para componentes por domínio.
- Introduzir virtualização para rankings e listas longas no mobile.
- Adicionar debounce em buscas admin se a lista crescer muito.
- Separar hooks de realtime por domínio para evitar refresh geral desnecessário.
