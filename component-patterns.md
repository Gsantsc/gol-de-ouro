# Gol de Ouro Component Patterns

## BrandLogo

Use `BrandLogo` em splash, login e headers principais. Em superficies compactas, use `compact` para exibir apenas o simbolo.

## Cards

Cards usam superficie glass `rgba(24,33,49,0.88)`, borda sutil e raio de 8 a 12 px. Evite cards aninhados; para subareas use linhas, divisores e tiles internos.

## MatchCard

O card de jogo deve seguir esta ordem:

1. Status e horario.
2. Mandante/visitante com placar.
3. Rail de palpite ou CTA.
4. Local/rodada e estado da janela.

## Bottom Navigation

Use 5 destinos no maximo. O ativo usa dourado, label curta e feedback de press. O componente deve manter largura estavel para nao deslocar labels.

## Admin Dashboard

Painel admin usa KPIs, listas densas e acoes rapidas. Botao primario dourado para acao principal; ghost para navegacao/saida; verde somente para aprovar/sucesso.

## Feedback

Skeleton antes de tabelas/listas, empty state com titulo e corpo, toast para resultado de acao e retry em erro recuperavel.
