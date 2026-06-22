const { getSupabaseServiceKey, getSupabaseUrl, optionalEnv } = require("./env.cjs");
const { buildWorldCup2026Dataset } = require("./world-cup-2026-dataset.cjs");

const SUPABASE_URL = getSupabaseUrl();
const SUPABASE_SERVICE_KEY = getSupabaseServiceKey();
const dryRun = process.argv.includes("--dry-run");
const now = new Date(optionalEnv("WORLD_CUP_REPAIR_NOW", new Date().toISOString()));

const headers = {
  apikey: SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

const readJson = async (response) => {
  const text = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${text}`);
  return text ? JSON.parse(text) : null;
};

const rest = async (path, options = {}) => {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: { ...headers, ...options.headers },
  });
  return readJson(response);
};

const normalizeDate = (value) => new Date(value).toISOString();

const normalizeTeam = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase()
    .replace(/^south korea$/, "korea republic")
    .replace(/^united states$/, "usa")
    .replace(/^united states of america$/, "usa")
    .replace(/^cape verde$/, "cabo verde")
    .replace(/^cote d ivoire$/, "cote d'ivoire")
    .replace(/^curacao$/, "curacao")
    .replace(/^turkiye$/, "turkey");

const calculateStatus = (match) => {
  const openAt = new Date(match.prediction_open_at);
  const closeAt = new Date(match.prediction_close_at);
  if (now < openAt) return "fechado";
  if (now < closeAt) return "aberto";
  return "ao_vivo";
};

const legacyStaticExternalIds = (matchNumber) => {
  const padded = String(matchNumber).padStart(3, "0");
  const legacy = [`static-wc2026-${padded}`];
  if (matchNumber === 1) legacy.push("static-wc2026-mexico-south-africa");
  if (matchNumber === 2) legacy.push("static-wc2026-korea-republic-czechia");
  return legacy;
};

const defaultScore = { away: 0, home: 0 };

const statsFor = (match, currentStats) => ({
  ...(currentStats && typeof currentStats === "object" ? currentStats : {}),
  city: match.city,
  country: match.country,
  espn_event_id: match.eventId,
  group: match.group,
  kickoff_brt: match.kickoffBrt,
  kickoff_local: match.kickoffLocal,
  match_number: match.matchNumber,
  source: match.source ?? "espn_fifa_world_cup_scoreboard",
  source_away_team: match.sourceAwayTeam,
  source_home_team: match.sourceHomeTeam,
  stage: match.stage,
  venue_timezone: match.venueTimezone,
});

const payloadFor = (current, match, dataset) => {
  const currentStats = current.stats && typeof current.stats === "object" ? current.stats : {};
  const sameEspnEvent = String(currentStats.espn_event_id ?? "") === String(match.eventId);
  const preserveFinalScore = sameEspnEvent && current.status === "encerrado";
  const homeScore = preserveFinalScore ? Number(current.home_score ?? 0) : 0;
  const awayScore = preserveFinalScore ? Number(current.away_score ?? 0) : 0;

  return {
    away_score: awayScore,
    away_team: match.awayTeam,
    championship: dataset.championship,
    display_time_br: match.kickoffBrt ?? null,
    home_score: homeScore,
    home_team: match.homeTeam,
    kickoff_source: match.source ?? "espn_fifa_world_cup_scoreboard",
    kickoff_verified_at: new Date().toISOString(),
    last_synced_at: new Date().toISOString(),
    live_score: preserveFinalScore ? current.live_score ?? { away: awayScore, home: homeScore } : defaultScore,
    prediction_close_at: match.prediction_close_at,
    prediction_open_at: match.prediction_open_at,
    provider_external_id: match.providerExternalId,
    provider_name: dataset.providerName,
    round: match.round,
    source_timezone: match.venueTimezone,
    stadium: match.stadium,
    start_time: match.startTime,
    start_time_utc: match.kickoffUtc ?? match.startTime,
    stats: statsFor(match, currentStats),
    status: preserveFinalScore ? "encerrado" : calculateStatus(match),
    venue_timezone: match.venueTimezone,
  };
};

const hasScheduleMismatch = (row, match) =>
  normalizeDate(row.start_time) !== normalizeDate(match.startTime)
  || normalizeTeam(row.home_team) !== normalizeTeam(match.homeTeam)
  || normalizeTeam(row.away_team) !== normalizeTeam(match.awayTeam)
  || String(row.provider_external_id ?? "") !== String(match.providerExternalId)
  || String(row.stats?.espn_event_id ?? "") !== String(match.eventId)
  || Number(row.stats?.match_number ?? 0) !== Number(match.matchNumber);

const findRowForMatch = (rows, usedIds, match) => {
  const legacyIds = legacyStaticExternalIds(match.matchNumber);
  const byExternalId = rows.find((row) =>
    !usedIds.has(row.id)
    && String(row.provider_external_id ?? "") === String(match.providerExternalId)
  );
  if (byExternalId) return byExternalId;

  const byLegacyExternalId = rows.find((row) =>
    !usedIds.has(row.id)
    && legacyIds.includes(String(row.provider_external_id ?? ""))
  );
  if (byLegacyExternalId) return byLegacyExternalId;

  return rows.find((row) =>
    !usedIds.has(row.id)
    && String(row.stats?.espn_event_id ?? "") === String(match.eventId)
  ) ?? null;
};

const listWorldCupMatches = async () =>
  rest(
    "matches?select=id,home_team,away_team,home_score,away_score,live_score,start_time,start_time_utc,display_time_br,provider_name,provider_external_id,status,stats,deleted_at&championship=eq.world_cup_2026&deleted_at=is.null&order=start_time.asc",
  );

const run = async () => {
  const dataset = buildWorldCup2026Dataset();
  if (dataset.matches.length !== 104) throw new Error(`Dataset invalido: esperado 104 jogos, recebeu ${dataset.matches.length}.`);

  const rows = await listWorldCupMatches();
  const usedIds = new Set();
  const missing = [];
  const changed = [];
  const unchanged = [];

  for (const match of dataset.matches) {
    const row = findRowForMatch(rows, usedIds, match);
    if (!row) {
      missing.push({ matchNumber: match.matchNumber, name: `${match.homeTeam} x ${match.awayTeam}` });
      continue;
    }
    usedIds.add(row.id);

    if (!hasScheduleMismatch(row, match)) {
      unchanged.push({ id: row.id, matchNumber: match.matchNumber });
      continue;
    }

    const payload = payloadFor(row, match, dataset);
    changed.push({
      id: row.id,
      matchNumber: match.matchNumber,
      from: {
        awayTeam: row.away_team,
        homeTeam: row.home_team,
        providerExternalId: row.provider_external_id,
        startTime: row.start_time,
      },
      to: {
        awayTeam: payload.away_team,
        homeTeam: payload.home_team,
        providerExternalId: payload.provider_external_id,
        startTime: payload.start_time,
      },
    });

    if (!dryRun) {
      await rest(`matches?id=eq.${row.id}`, {
        body: JSON.stringify(payload),
        method: "PATCH",
      });
    }
  }

  const unusedRows = rows.filter((row) => !usedIds.has(row.id)).map((row) => ({
    id: row.id,
    awayTeam: row.away_team,
    homeTeam: row.home_team,
    providerExternalId: row.provider_external_id,
    startTime: row.start_time,
  }));

  console.log(JSON.stringify({
    dryRun,
    changed: changed.length,
    missing,
    now: now.toISOString(),
    totalDatasetMatches: dataset.matches.length,
    totalRemoteMatches: rows.length,
    unchanged: unchanged.length,
    unusedRows,
    sample: changed.slice(0, 10),
  }, null, 2));

  if (missing.length || unusedRows.length) {
    process.exitCode = 1;
  }
};

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
