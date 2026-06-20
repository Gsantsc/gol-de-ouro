const fs = require("fs");
const path = require("path");

const HOUR_MS = 60 * 60 * 1000;
const DATASET_PATH = path.resolve(__dirname, "..", "data", "world-cup-2026.json");

const readOpeningFixtures = () => {
  const dataset = JSON.parse(fs.readFileSync(DATASET_PATH, "utf8"));
  return (dataset.matches ?? []).slice(0, 2).map((match) => ({
    away_team: match.away_team,
    home_team: match.home_team,
    provider_external_id: match.provider_external_id,
    round: match.round,
    stadium: match.venue,
    start_time: match.kickoff_utc,
    venue_timezone: match.venue_timezone,
  }));
};

const staticWC2026Fixtures = readOpeningFixtures();

const defaultStats = () => ({
  cornersAway: 0,
  cornersHome: 0,
  foulsAway: 0,
  foulsHome: 0,
  possessionAway: 50,
  possessionHome: 50,
  redCardsAway: 0,
  redCardsHome: 0,
  shotsAway: 0,
  shotsHome: 0,
  shotsOnGoalAway: 0,
  shotsOnGoalHome: 0,
  xgAway: 0,
  xgHome: 0,
  yellowCardsAway: 0,
  yellowCardsHome: 0,
});

const predictionWindowPayload = (startTime) => {
  const startAt = new Date(startTime);
  return {
    prediction_close_at: new Date(startAt.getTime() - HOUR_MS).toISOString(),
    prediction_open_at: new Date(startAt.getTime() - 24 * HOUR_MS).toISOString(),
  };
};

const calculateStatus = (startTime) => {
  const windowPayload = predictionWindowPayload(startTime);
  const now = new Date();
  const openAt = new Date(windowPayload.prediction_open_at);
  const closeAt = new Date(windowPayload.prediction_close_at);
  if (now < openAt) return "fechado";
  if (now < closeAt) return "aberto";
  return "ao_vivo";
};

const staticWC2026Payloads = (tournamentId) =>
  staticWC2026Fixtures.map((fixture) => ({
    away_score: 0,
    away_team: fixture.away_team,
    away_team_logo_url: null,
    championship: "world_cup_2026",
    home_score: 0,
    home_team: fixture.home_team,
    home_team_logo_url: null,
    last_synced_at: new Date().toISOString(),
    live_score: { away: 0, home: 0 },
    ...predictionWindowPayload(fixture.start_time),
    provider_external_id: fixture.provider_external_id,
    provider_name: "static-wc2026",
    round: fixture.round,
    stadium: fixture.stadium,
    start_time: fixture.start_time,
    start_time_utc: fixture.start_time,
    stats: {
      ...defaultStats(),
      source: "espn_fifa_world_cup_scoreboard",
      venue_timezone: fixture.venue_timezone,
    },
    status: calculateStatus(fixture.start_time),
    tournament_id: tournamentId,
    venue_timezone: fixture.venue_timezone,
  }));

module.exports = {
  staticWC2026Payloads,
};
