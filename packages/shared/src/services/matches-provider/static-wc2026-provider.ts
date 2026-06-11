import type { MatchesProvider, ProviderMatch, ProviderMatchStats } from "./types";

const defaultStats = (): ProviderMatchStats => ({
  possessionAway: 50,
  possessionHome: 50,
  shotsAway: 0,
  shotsHome: 0,
  shotsOnGoalAway: 0,
  shotsOnGoalHome: 0,
  cornersAway: 0,
  cornersHome: 0,
  foulsAway: 0,
  foulsHome: 0,
  redCardsAway: 0,
  redCardsHome: 0,
  xgAway: 0,
  xgHome: 0,
  yellowCardsAway: 0,
  yellowCardsHome: 0,
});

const fallbackFixtures: ProviderMatch[] = [
  {
    awayLogoUrl: null,
    awayScore: 0,
    awayTeam: "South Africa",
    championship: "world_cup_2026",
    events: [],
    externalId: "static-wc2026-mexico-south-africa",
    hasFinalScore: false,
    homeLogoUrl: null,
    homeScore: 0,
    homeTeam: "Mexico",
    kickoff: "2026-06-11T16:00:00.000Z",
    round: "Grupo A",
    stadium: "Estadio a confirmar",
    status: "fechado",
    stats: defaultStats(),
  },
  {
    awayLogoUrl: null,
    awayScore: 0,
    awayTeam: "Czechia",
    championship: "world_cup_2026",
    events: [],
    externalId: "static-wc2026-korea-republic-czechia",
    hasFinalScore: false,
    homeLogoUrl: null,
    homeScore: 0,
    homeTeam: "Korea Republic",
    kickoff: "2026-06-11T23:00:00.000Z",
    round: "Grupo",
    stadium: "Estadio a confirmar",
    status: "fechado",
    stats: defaultStats(),
  },
];

export const staticWC2026Provider: MatchesProvider = {
  name: "static-wc2026",
  listMatches: async () => fallbackFixtures,
};
