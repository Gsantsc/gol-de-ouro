const {
  getSupabaseServiceKey,
  getSupabaseUrl,
  optionalEnv,
} = require("./env.cjs");
const { fetchApiFootball, getApiFootballRequestCount } = require("./api-football.cjs");
const { staticWC2026Payloads } = require("./static-wc2026-fixtures.cjs");

const SUPABASE_URL = getSupabaseUrl();
const SUPABASE_SERVICE_KEY = getSupabaseServiceKey();
const dryRun = process.argv.includes("--dry-run");
const HOUR_MS = 60 * 60 * 1000;

const PROVIDER = "api-football";
const FALLBACK_PROVIDER = "static-wc2026";
const CHAMPIONSHIP = "world_cup_2026";
const LEAGUE_ID = Number(optionalEnv("API_FOOTBALL_WORLD_CUP_LEAGUE_ID", "1"));
const SEASON = Number(optionalEnv("API_FOOTBALL_WORLD_CUP_SEASON", "2026"));
const MAX_FIXTURE_PAGES = Number(optionalEnv("API_FOOTBALL_MAX_FIXTURE_PAGES", "4"));
const TIMEZONE = optionalEnv("MATCHES_PROVIDER_TIMEZONE", "America/Sao_Paulo");
const FROM_DATE = optionalEnv("API_FOOTBALL_FROM_DATE", "");
const TO_DATE = optionalEnv("API_FOOTBALL_TO_DATE", "2026-12-31");

const headers = {
  apikey: SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

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

const readJson = async (response) => {
  const text = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${text}`);
  return text ? JSON.parse(text) : null;
};

const rest = async (path, options = {}) => {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
    body: options.body && typeof options.body !== "string" ? JSON.stringify(options.body) : options.body,
  });
  return readJson(response);
};

const predictionWindowPayload = (startTime) => {
  const startAt = new Date(startTime);
  return {
    prediction_close_at: new Date(startAt.getTime() - HOUR_MS).toISOString(),
    prediction_open_at: new Date(startAt.getTime() - 24 * HOUR_MS).toISOString(),
  };
};

const statusFromApi = (status) => {
  if (!status || ["NS", "TBD"].includes(status)) return "fechado";
  if (["1H", "2H", "HT", "ET", "P", "BT", "LIVE"].includes(status)) return "ao_vivo";
  if (["FT", "AET", "PEN"].includes(status)) return "encerrado";
  return "fechado";
};

const calculateStatus = ({ providerStatus, startTime, windowPayload }) => {
  if (providerStatus === "encerrado" || providerStatus === "ao_vivo") return providerStatus;
  const now = new Date();
  const openAt = new Date(windowPayload.prediction_open_at);
  const closeAt = new Date(windowPayload.prediction_close_at);
  if (now < openAt) return "fechado";
  if (now < closeAt) return "aberto";
  return "ao_vivo";
};

const ensureTournament = async () => {
  const existing = await rest(`tournaments?select=id&slug=eq.${CHAMPIONSHIP}`);
  if (existing?.[0]?.id) return existing[0].id;

  if (dryRun) return "dry-run-tournament";

  const inserted = await rest("tournaments", {
    body: {
      active: true,
      name: "Copa do Mundo 2026",
      slug: CHAMPIONSHIP,
      type: "world_cup",
    },
    method: "POST",
  });
  return inserted?.[0]?.id;
};

const fetchFixtures = async () => {
  const fixtures = [];

  for (let page = 1; page <= MAX_FIXTURE_PAGES; page += 1) {
    const result = await fetchApiFootball("fixtures", {
      from: FROM_DATE || undefined,
      league: LEAGUE_ID,
      page,
      season: SEASON,
      timezone: TIMEZONE,
      to: TO_DATE,
    });

    const pageFixtures = result.response ?? [];
    fixtures.push(...pageFixtures);

    const current = result.paging?.current ?? page;
    const total = result.paging?.total ?? page;
    if (pageFixtures.length === 0 || current >= total) break;
  }

  return fixtures;
};

const mapFixture = (fixture, tournamentId) => {
  const fixtureId = fixture.fixture?.id;
  const startTime = fixture.fixture?.date;
  const home = fixture.teams?.home;
  const away = fixture.teams?.away;
  if (!fixtureId || !startTime || !home?.name || !away?.name) return null;

  const windowPayload = predictionWindowPayload(startTime);
  const providerStatus = statusFromApi(fixture.fixture?.status?.short);
  const status = calculateStatus({ providerStatus, startTime, windowPayload });

  return {
    away_score: fixture.goals?.away ?? 0,
    away_team: away.name,
    away_team_logo_url: away.logo ?? null,
    championship: CHAMPIONSHIP,
    home_score: fixture.goals?.home ?? 0,
    home_team: home.name,
    home_team_logo_url: home.logo ?? null,
    last_synced_at: new Date().toISOString(),
    live_score: { away: fixture.goals?.away ?? 0, home: fixture.goals?.home ?? 0 },
    ...windowPayload,
    provider_external_id: String(fixtureId),
    provider_name: PROVIDER,
    round: fixture.league?.round ?? "Rodada",
    stadium: [fixture.fixture?.venue?.name, fixture.fixture?.venue?.city].filter(Boolean).join(" - ") || "Estadio a confirmar",
    start_time: startTime,
    stats: defaultStats(),
    status,
    tournament_id: tournamentId,
  };
};

const upsertMatch = async (payload) => {
  const existing = await rest(
    `matches?select=id,status&provider_name=eq.${payload.provider_name}&provider_external_id=eq.${payload.provider_external_id}`,
  );
  const current = existing?.[0];
  const nextPayload = current?.status === "encerrado"
    ? {
        ...payload,
        away_score: undefined,
        home_score: undefined,
        live_score: undefined,
        status: "encerrado",
      }
    : payload;

  Object.keys(nextPayload).forEach((key) => nextPayload[key] === undefined && delete nextPayload[key]);

  if (dryRun) return current ? "updated" : "inserted";

  if (current?.id) {
    await rest(`matches?id=eq.${current.id}`, {
      body: nextPayload,
      method: "PATCH",
    });
    return "updated";
  }

  await rest("matches", {
    body: nextPayload,
    method: "POST",
  });
  return "inserted";
};

const main = async () => {
  if (optionalEnv("MATCHES_PROVIDER", "api-football") !== "api-football") {
    console.log(JSON.stringify({ skipped: true, reason: "MATCHES_PROVIDER is not api-football" }, null, 2));
    return;
  }

  let fixtures = [];
  let useFallback = false;
  try {
    fixtures = await fetchFixtures();
  } catch (error) {
    console.warn(`API-Football failed. Using fallback provider ${optionalEnv("MATCHES_FALLBACK_PROVIDER", "static-wc2026")}.`);
    console.warn(error instanceof Error ? error.message : error);
    useFallback = true;
  }

  if (!useFallback && !fixtures.length) {
    console.warn(`API-Football returned 0 fixtures. Using fallback provider ${optionalEnv("MATCHES_FALLBACK_PROVIDER", "static-wc2026")}.`);
    useFallback = true;
  }

  const tournamentId = await ensureTournament();
  const payloads = useFallback
    ? staticWC2026Payloads(tournamentId)
    : fixtures.map((fixture) => mapFixture(fixture, tournamentId)).filter(Boolean);
  let inserted = 0;
  let updated = 0;

  for (const payload of payloads) {
    const action = await upsertMatch(payload);
    if (action === "inserted") inserted += 1;
    else updated += 1;
  }

  console.log(JSON.stringify({
    dryRun,
    fetched: fixtures.length,
    inserted,
    provider: useFallback ? FALLBACK_PROVIDER : PROVIDER,
    requestsUsed: getApiFootballRequestCount(),
    updated,
  }, null, 2));
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
