import type { MatchesProvider, ProviderMatch, ProviderMatchStats } from "./types";
import { resolveFlagUrlForTeam } from "../../team-flags";
import { staticWC2026Fixtures } from "./static-wc2026-data";

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

const fallbackFixtures: ProviderMatch[] = staticWC2026Fixtures.map((fixture) => ({
  awayLogoUrl: resolveFlagUrlForTeam(fixture.awayTeam),
  awayScore: 0,
  awayTeam: fixture.awayTeam,
  championship: "world_cup_2026",
  events: [],
  externalId: fixture.externalId,
  hasFinalScore: false,
  homeLogoUrl: resolveFlagUrlForTeam(fixture.homeTeam),
  homeScore: 0,
  homeTeam: fixture.homeTeam,
  kickoff: fixture.kickoff,
  round: fixture.round,
  stadium: fixture.stadium,
  status: "fechado",
  stats: {
    ...defaultStats(),
    city: fixture.city,
    country: fixture.country,
    espn_event_id: fixture.eventId,
    group: fixture.group,
    kickoff_brt: fixture.kickoffBrt,
    kickoff_local: fixture.kickoffLocal,
    match_number: fixture.matchNumber,
    source: fixture.source,
    source_away_team: fixture.sourceAwayTeam,
    source_home_team: fixture.sourceHomeTeam,
    stage: fixture.stage,
    venue_timezone: fixture.venueTimezone,
  },
}));

export const staticWC2026Provider: MatchesProvider = {
  name: "static-wc2026",
  listMatches: async () => fallbackFixtures,
};
