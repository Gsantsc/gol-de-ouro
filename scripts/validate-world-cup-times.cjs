const fs = require("fs");
const path = require("path");
const { buildWorldCup2026Dataset } = require("./world-cup-2026-dataset.cjs");

const rootDir = path.resolve(__dirname, "..");
const datasetPath = path.join(rootDir, "data", "world-cup-2026.json");
const BRAZIL_TZ = "America/Sao_Paulo";
const HOUR_MS = 60 * 60 * 1000;

const fail = (message, details = {}) => {
  const error = new Error(message);
  error.details = details;
  throw error;
};

const formatBr = (value) =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: BRAZIL_TZ,
  }).format(new Date(value));

const assertIso = (value, label, match) => {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) fail(`${label} invalido.`, { match, value });
  return date;
};

const readRawDataset = () => JSON.parse(fs.readFileSync(datasetPath, "utf8"));

const validate = () => {
  const raw = readRawDataset();
  const dataset = buildWorldCup2026Dataset();
  const rawMatches = raw.matches ?? [];
  if (rawMatches.length !== 104) fail("Dataset deve conter 104 jogos.", { matches: rawMatches.length });
  if (dataset.matches.length !== 104) fail("Dataset normalizado deve conter 104 jogos.", { matches: dataset.matches.length });
  if (dataset.teams.length !== 48) fail("Dataset deve conter 48 selecoes.", { teams: dataset.teams.length });
  if (dataset.groups.length !== 12) fail("Dataset deve conter 12 grupos.", { groups: dataset.groups.length });

  const seen = new Set();
  for (const match of rawMatches) {
    if (seen.has(match.match_number)) fail("match_number duplicado.", { match_number: match.match_number });
    seen.add(match.match_number);
    if (!match.provider_external_id) fail("provider_external_id ausente.", { match });
    if (!match.venue_timezone) fail("venue_timezone ausente.", { match });
    if (!match.kickoff_brt) fail("kickoff_brt ausente.", { match });
    const kickoff = assertIso(match.kickoff_utc, "kickoff_utc", match);
    const openAt = assertIso(match.prediction_open_at, "prediction_open_at", match);
    const closeAt = assertIso(match.prediction_close_at, "prediction_close_at", match);
    if (kickoff.getTime() - openAt.getTime() !== 24 * HOUR_MS) {
      fail("prediction_open_at deve ser kickoff_utc - 24h.", { match_number: match.match_number });
    }
    if (kickoff.getTime() - closeAt.getTime() !== HOUR_MS) {
      fail("prediction_close_at deve ser kickoff_utc - 1h.", { match_number: match.match_number });
    }
  }

  const byTeams = new Map(rawMatches.map((match) => [`${match.home_team}|${match.away_team}`, match]));
  const references = [
    ["Mexico|South Africa", "11/06/2026, 16:00"],
    ["USA|Australia", "19/06/2026, 16:00"],
    ["Scotland|Morocco", "19/06/2026, 19:00"],
    ["Brazil|Haiti", "19/06/2026, 21:30"],
    ["Turkey|Paraguay", "20/06/2026, 00:00"],
  ];
  const checkedReferences = references.map(([key, expected]) => {
    const match = byTeams.get(key);
    if (!match) fail("Jogo de referencia ausente.", { key });
    const actual = formatBr(match.kickoff_utc);
    if (actual !== expected) fail("Horario BR de referencia incorreto.", { key, expected, actual });
    return { expected, key, kickoff_utc: match.kickoff_utc };
  });

  return {
    checkedReferences,
    displayTimezone: BRAZIL_TZ,
    matches: rawMatches.length,
    source: raw.source,
    status: "ok",
  };
};

try {
  console.log(JSON.stringify(validate(), null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  if (error?.details) console.error(JSON.stringify(error.details, null, 2));
  process.exitCode = 1;
}
