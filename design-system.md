# Design System

## Identidade Oficial

- Background: `#0B0F19`
- Surface: `#121826`
- Card: `#182131`
- Gold Primary: `#D4AF37`
- Gold Highlight: `#F6D365`
- Gold Dark: `#A98224`
- Blue Accent: `#2563EB`
- Text Primary: `#F8FAFC`
- Text Secondary: `#94A3B8`
- Border: `#263244`
- Success: `#22C55E`
- Warning: `#F59E0B`
- Error: `#EF4444`

## Tokens

- `colors.ts`: fonte oficial de cores.
- `color-system.ts`: compatibilidade com imports existentes.
- `spacing.ts`: escala base de 4px.
- `typography.ts`: tamanhos e pesos principais.
- `design-tokens.ts`: composição de cor, spacing, radius, shadow, motion e type.
- `theme.ts`: tema premium do app.

## Padrões

- Cards: raio de 8px, borda sutil e sombra controlada.
- Botões: altura mínima de 44px no web e 46px no mobile.
- Tabs: estado ativo com dourado, indicador visual e foco visível.
- Inputs: contraste alto, foco dourado e labels legíveis.
- Skeletons: linhas neutras com baixa opacidade.
- Empty states: título curto, texto de orientação e ação quando existir.

## Diretriz de Implementação

Evitar novos valores diretos de cor e spacing em componentes. Quando a plataforma impedir import compartilhado, como no Metro mobile atual, manter tokens locais espelhados e documentados.
