# User Flow Map - Gol de Ouro

## Escopo

Fluxo do usuário separado do Admin. A autenticação, aprovação, Supabase, provider WC2026, cálculo de pontos e regras de negócio não devem ser alterados para este redesenho.

## Web

- Home: `apps/admin/src/app/dashboard/page.tsx`, componente `HomePanel`.
- Jogos: `apps/admin/src/app/dashboard/page.tsx`, componente `GamesPanel`.
- Palpites: `apps/admin/src/app/dashboard/page.tsx`, componente `PredictionsPanel`.
- Ligas: `apps/admin/src/app/dashboard/page.tsx`, componente `UserGroupsPanel`.
- Ranking: `apps/admin/src/app/dashboard/page.tsx`, componente `RankingPanel`.
- Perfil: `apps/admin/src/app/dashboard/page.tsx`, componente `ProfilePanel`.
- Navegação web: `tabs` e `nav-shell` em `apps/admin/src/app/dashboard/page.tsx` + `apps/admin/src/app/globals.css`.
- Dados do usuário: `apps/admin/src/lib/user-api.ts`.

## Mobile

- Home: `apps/mobile/src/screens/HomeScreen.tsx`.
- Jogos: `apps/mobile/src/screens/TournamentsScreen.tsx`.
- Palpites: `apps/mobile/src/screens/PredictionsScreen.tsx`.
- Ligas: `apps/mobile/src/screens/GroupsScreen.tsx`.
- Ranking: `apps/mobile/src/screens/RankingScreen.tsx`.
- Perfil: `apps/mobile/src/screens/ProfileScreen.tsx`.
- Navegação mobile: `apps/mobile/src/components/BottomTabs.tsx` e `apps/mobile/src/screens/AppRoot.tsx`.
- Card de jogo mobile: `apps/mobile/src/components/MatchCard.tsx`.
- Dados mobile: `apps/mobile/src/hooks/useFootballData.ts` e `apps/mobile/src/services/football.service.ts`.

## Fluxo Esperado

- Home > Palpitar agora > modal/tela de palpite > Palpites.
- Jogos > Palpitar > Jogos mostra `Palpite enviado`; Palpites mostra detalhes.
- Home > Ver todas as ligas > Ligas.
- Ligas > Entrar na liga > detalhe da liga.
- Ranking > Minhas ligas > detalhe/ranking da liga.
- Perfil > Conquistas > lista visual de conquistas.

