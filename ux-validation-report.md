# Gol de Ouro - Validação UX

Data: 2026-06-05

## Resultado

Status: aprovado com evidência visual gerada.

## Telas validadas

- Home
- Jogos
- Palpites
- Ranking
- Ligas
- Perfil
- Tablet
- Mobile Home
- Mobile Jogos
- Mobile Perfil

## Evidências

- `artifacts/qa-user-flow-home.png`
- `artifacts/qa-user-flow-games.png`
- `artifacts/qa-user-flow-predictions.png`
- `artifacts/qa-user-flow-ranking.png`
- `artifacts/qa-user-flow-groups.png`
- `artifacts/qa-user-flow-profile.png`
- `artifacts/qa-user-flow-tablet.png`
- `artifacts/qa-user-flow-mobile-home.png`
- `artifacts/qa-user-flow-mobile-games.png`
- `artifacts/qa-user-flow-mobile-profile.png`
- `artifacts/qa-user-flow-visual-evidence.gif`
- `artifacts/qa-user-flow-visual-evidence.json`

## Ajustes feitos nesta rodada

- Corrigido o capturador visual `scripts/capture-user-flow-cdp.cjs` para usar `ws` quando `WebSocket` global não existir.
- Corrigido o login automatizado do capturador para clicar no botão submit real, não na aba "Entrar".
- Corrigida a navegação mobile do dashboard para aparecer em grid compacto, sem corte horizontal.
- Adicionado timeout de UX nas chamadas Supabase do web/admin para evitar spinner infinito em sessão ou rede travada.
- Ajustado o client Supabase web para evitar lock de sessão do navegador por padrão, mantendo opção via `NEXT_PUBLIC_SUPABASE_BROWSER_LOCKS=true`.

## UX validada

- Login do usuário funciona no cenário QA.
- Home mostra pontos, acertos, ranking, próximo palpite, últimos resultados, ligas e notificações.
- Jogos mostra lista densa de partidas com leitura rápida.
- Palpites reflete o palpite editado.
- Ranking reflete pontuação calculada.
- Ligas mostra a liga do usuário e acesso por botão.
- Perfil mostra estatísticas e conquistas persistidas.
- Mobile não apresenta overflow horizontal na navegação principal.

## Observações

- A captura em modo dev/Turbopack ficava presa no loading em Edge headless. A evidência visual final foi gerada com o dashboard em modo produção (`next build` + `next start`), que é o cenário mais próximo de publicação.
- Primeiro jogador a marcar e homem do jogo continuam não implementados como feature. Não foram inventados nesta rodada para preservar escopo e regra de negócio.
