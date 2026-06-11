// LEAGUE AUDIT
// REMOVE MOCK MATCH DATA - Commented out mock teams, using API-Football sync only
import { CHAMPIONSHIP_KEYS, CHAMPIONSHIP_LABELS } from "../../constants";
import type { ChampionshipKey } from "../../types";
import type { MatchesProvider, ProviderMatch, ProviderMatchStats } from "./types";

// REMOVE MOCK MATCH DATA - Commented out mock teams, using API-Football sync only
// const teamsByChampionship: Record<ChampionshipKey, Array<[string, string, string | null, string | null]>> = {
//   world_cup_2026: [
//     ["Brasil", "Mexico", "https://flagcdn.com/w80/br.png", "https://flagcdn.com/w80/mx.png"],
//     ["Estados Unidos", "Canada", "https://flagcdn.com/w80/us.png", "https://flagcdn.com/w80/ca.png"],
//   ],
//   brasileirao_a: [
//     ["Flamengo", "Palmeiras", null, null],
//     ["Sao Paulo", "Gremio", null, null],
//   ],
//   copa_do_brasil: [
//     ["Flamengo", "Corinthians", null, null],
//     ["Cruzeiro", "Vasco", null, null],
//   ],
//   champions_league: [
//     ["Real Madrid", "Manchester City", null, null],
//     ["Bayern de Munique", "PSG", null, null],
//   ],
//   libertadores: [
//     ["Fluminense", "River Plate", null, null],
//     ["Boca Juniors", "Atletico-MG", null, null],
//   ],
//   sul_americana: [
//     ["Athletico-PR", "LDU", null, null],
//     ["Independiente", "Fortaleza", null, null],
//   ],
// };

// REMOVE MOCK MATCH DATA - Commented out buildStats, using API-Football sync only
// const buildStats = (seed: number): ProviderMatchStats => ({
//   possessionHome: 48 + (seed % 8),
//   possessionAway: 52 - (seed % 8),
//   shotsHome: 8 + seed,
//   shotsAway: 6 + seed,
//   shotsOnGoalHome: 3 + (seed % 3),
//   shotsOnGoalAway: 2 + (seed % 3),
//   cornersHome: 3 + (seed % 4),
//   cornersAway: 2 + (seed % 4),
//   foulsHome: 8 + seed,
//   foulsAway: 9 + seed,
//   yellowCardsHome: seed % 3,
//   yellowCardsAway: (seed + 1) % 3,
//   redCardsHome: 0,
//   redCardsAway: 0,
//   xgHome: Number((1.1 + seed * 0.2).toFixed(2)),
//   xgAway: Number((0.8 + seed * 0.18).toFixed(2)),
// });

// REMOVE MOCK MATCH DATA - Commented out buildAutomaticMatchFixtures, using API-Football sync only
// export const buildAutomaticMatchFixtures = (baseDate = new Date()): ProviderMatch[] => {
//   // Data base: 20/05/2026 (data atual do sistema)
//   const targetDate = new Date('2026-05-20T00:00:00');
//
//   // Datas reais aproximadas para cada campeonato a partir de 20/05/2026
//   const championshipDates: Record<ChampionshipKey, Date[]> = {
//     world_cup_2026: [
//       new Date('2026-05-20T19:00:00'), // Brasil vs Mexico (hoje)
//       new Date('2026-06-14T13:00:00'), // Estados Unidos vs Canada
//     ],
//     brasileirao_a: [
//       new Date('2026-05-20T21:00:00'), // Flamengo vs Palmeiras (hoje)
//       new Date('2026-05-24T19:00:00'), // Sao Paulo vs Gremio
//     ],
//     copa_do_brasil: [
//       new Date('2026-05-21T19:30:00'), // Flamengo vs Corinthians
//       new Date('2026-06-02T16:00:00'), // Cruzeiro vs Vasco
//     ],
//     champions_league: [
//       new Date('2026-05-21T16:00:00'), // Real Madrid vs Manchester City
//       new Date('2026-05-29T19:00:00'), // Bayern de Munique vs PSG
//     ],
//     libertadores: [
//       new Date('2026-05-20T19:00:00'), // Fluminense vs River Plate (hoje)
//       new Date('2026-05-23T19:00:00'), // Boca Juniors vs Atletico-MG
//     ],
//     sul_americana: [
//       new Date('2026-05-20T21:30:00'), // Athletico-PR vs LDU (hoje)
//       new Date('2026-05-22T21:30:00'), // Independiente vs Fortaleza
//     ],
//   };
//
//   return CHAMPIONSHIP_KEYS.flatMap((championship) => {
//     const dates = championshipDates[championship] || [];
//     return teamsByChampionship[championship].map((fixture, fixtureIndex) => {
//       const kickoff = dates[fixtureIndex] || new Date(targetDate);
//       kickoff.setHours(kickoff.getHours() - 3); // Ajustar para timezone America/Sao_Paulo (UTC-3)
//
//       const [homeTeam, awayTeam, homeLogoUrl, awayLogoUrl] = fixture;
//       const seed = fixtureIndex + 1;
//
//       return {
//         awayLogoUrl,
//         awayScore: 0,
//         awayTeam,
//         championship,
//         events: [],
//         externalId: `local-${championship}-${fixtureIndex + 1}`,
//         homeLogoUrl,
//         homeScore: 0,
//         homeTeam,
//         kickoff: kickoff.toISOString(),
//         round: fixtureIndex === 0 ? "Rodada 1" : "Rodada 2",
//         stadium: `${CHAMPIONSHIP_LABELS[championship]} Arena`,
//         status: kickoff < new Date() ? "encerrado" : "aberto",
//         stats: buildStats(seed),
//       };
//     });
//   });
// };

// REMOVE MOCK MATCH DATA - Empty provider for compatibility, should not be used
export const localMatchesProvider: MatchesProvider = {
  name: "local-fixtures",
  listMatches: async () => [],
};
