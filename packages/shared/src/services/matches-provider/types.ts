import type { ChampionshipKey, MatchStatus } from "../../types";

export type ProviderMatchStats = {
  possessionHome: number;
  possessionAway: number;
  shotsHome: number;
  shotsAway: number;
  shotsOnGoalHome: number;
  shotsOnGoalAway: number;
  cornersHome: number;
  cornersAway: number;
  foulsHome: number;
  foulsAway: number;
  yellowCardsHome: number;
  yellowCardsAway: number;
  redCardsHome: number;
  redCardsAway: number;
  xgHome: number;
  xgAway: number;
};

export type ProviderMatchEvent = {
  minute: number;
  type: "goal" | "yellow_card" | "red_card" | "substitution";
  description: string;
};

export type ProviderMatch = {
  externalId: string;
  championship: ChampionshipKey;
  homeTeam: string;
  awayTeam: string;
  homeLogoUrl: string | null;
  awayLogoUrl: string | null;
  kickoff: string;
  stadium: string;
  round: string;
  status: MatchStatus;
  homeScore: number;
  awayScore: number;
  hasFinalScore?: boolean;
  stats: ProviderMatchStats;
  events: ProviderMatchEvent[];
};

export type MatchesProvider = {
  name: string;
  listMatches: () => Promise<ProviderMatch[]>;
};
