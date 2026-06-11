# Matches Provider

Camada desacoplada para ingestao de partidas.

Implementacao local atual:

- `packages/shared/src/services/matches-provider/local-provider.ts`

Contrato:

- `MatchesProvider`
- `ProviderMatch`

Quando houver uma API esportiva externa, crie outro provider seguindo o mesmo contrato e troque a chamada do painel admin sem alterar telas ou banco.
