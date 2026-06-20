const fs = require("fs");
const path = require("path");

const PROVIDER_NAME = "static-wc2026";
const CHAMPIONSHIP = "world_cup_2026";
const TOURNAMENT_NAME = "Copa do Mundo 2026";
const DATASET_PATH = path.resolve(__dirname, "..", "data", "world-cup-2026.json");

const groups = [
  { name: "Grupo A", code: "A", teams: ["Mexico", "South Africa", "Korea Republic", "Czechia"] },
  { name: "Grupo B", code: "B", teams: ["Canada", "Switzerland", "Qatar", "Norway"] },
  { name: "Grupo C", code: "C", teams: ["Brazil", "Morocco", "Haiti", "Scotland"] },
  { name: "Grupo D", code: "D", teams: ["USA", "Paraguay", "Australia", "Turkey"] },
  { name: "Grupo E", code: "E", teams: ["Argentina", "Algeria", "Austria", "Jordan"] },
  { name: "Grupo F", code: "F", teams: ["France", "Colombia", "Ghana", "Iraq"] },
  { name: "Grupo G", code: "G", teams: ["Spain", "Saudi Arabia", "Cabo Verde", "New Zealand"] },
  { name: "Grupo H", code: "H", teams: ["England", "Japan", "Tunisia", "Panama"] },
  { name: "Grupo I", code: "I", teams: ["Germany", "Uruguay", "Uzbekistan", "Cote d'Ivoire"] },
  { name: "Grupo J", code: "J", teams: ["Portugal", "Ecuador", "Congo DR", "Curacao"] },
  { name: "Grupo K", code: "K", teams: ["Netherlands", "Senegal", "IR Iran", "Bosnia-Herzegovina"] },
  { name: "Grupo L", code: "L", teams: ["Belgium", "Croatia", "Egypt", "Sweden"] },
];

const readSchedule = () => {
  const content = fs.readFileSync(DATASET_PATH, "utf8");
  const parsed = JSON.parse(content);
  if (!Array.isArray(parsed.matches)) throw new Error("data/world-cup-2026.json invalido: matches ausente.");
  return parsed.matches;
};

const normalizeMatch = (match) => ({
  awayTeam: match.away_team,
  city: match.city,
  country: match.country,
  eventId: match.event_id,
  group: match.group,
  homeTeam: match.home_team,
  kickoffBrt: match.kickoff_brt,
  kickoffLocal: match.kickoff_local,
  kickoffUtc: match.kickoff_utc,
  matchNumber: match.match_number,
  prediction_close_at: match.prediction_close_at,
  prediction_open_at: match.prediction_open_at,
  providerExternalId: match.provider_external_id,
  round: match.round,
  source: match.source,
  sourceAwayTeam: match.source_away_team,
  sourceHomeTeam: match.source_home_team,
  stage: match.stage,
  stadium: match.venue,
  startTime: match.kickoff_utc,
  venueTimezone: match.venue_timezone,
});

const buildWorldCup2026Dataset = () => {
  const matches = readSchedule().map(normalizeMatch);
  const teams = groups.flatMap((group) => group.teams.map((name, index) => ({ group: group.code, name, seed: index + 1 })));
  return { championship: CHAMPIONSHIP, groups, matches, providerName: PROVIDER_NAME, teams, tournamentName: TOURNAMENT_NAME };
};

module.exports = { buildWorldCup2026Dataset, CHAMPIONSHIP, PROVIDER_NAME, TOURNAMENT_NAME };
