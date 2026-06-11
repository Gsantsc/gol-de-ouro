const {
  getSupabaseServiceKey,
  getSupabaseUrl,
  optionalEnv,
} = require("./env.cjs");
const { spawnSync } = require("child_process");
const path = require("path");
const { fetchApiFootball, getApiFootballRequestCount } = require("./api-football.cjs");

const SUPABASE_URL = getSupabaseUrl();
const SUPABASE_SERVICE_KEY = getSupabaseServiceKey();
const dryRun = process.argv.includes("--dry-run");

const WORLD_CUP_LEAGUE_ID = Number(optionalEnv("API_FOOTBALL_WORLD_CUP_LEAGUE_ID", "1"));
const WORLD_CUP_SEASON = Number(optionalEnv("API_FOOTBALL_WORLD_CUP_SEASON", "2026"));
const MAX_PLAYER_TEAMS = Number(optionalEnv("API_FOOTBALL_MAX_PLAYER_TEAMS", "48"));
const MAX_PLAYER_PAGES = Number(optionalEnv("API_FOOTBALL_MAX_PLAYER_PAGES", "1"));
const nodeCommand = process.execPath;

const headers = {
  apikey: SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

const normalizeTeamCode = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

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

const positionFromApi = (value) => {
  const normalized = String(value ?? "").toLowerCase();
  if (!normalized) return null;
  if (normalized.includes("goalkeeper")) return "goalkeeper";
  if (normalized.includes("defender")) return "defender";
  if (normalized.includes("midfielder")) return "midfielder";
  if (normalized.includes("attacker")) return "forward";
  return normalized;
};

const fetchTeams = async () => {
  const result = await fetchApiFootball("teams", {
    league: WORLD_CUP_LEAGUE_ID,
    season: WORLD_CUP_SEASON,
  });

  return (result.response ?? [])
    .map((item) => item.team)
    .filter((team) => team?.id && team?.name)
    .map((team) => ({
      code: team.code || normalizeTeamCode(team.name),
      id: team.id,
      name: team.name,
    }));
};

const runStaticFallback = () => {
  console.warn("Using static WC2026 players fallback.");
  const fallbackScript = path.join(__dirname, "seed-players-world-cup-2026.cjs");
  const args = [fallbackScript];
  if (dryRun) args.push("--dry-run");
  const result = spawnSync(nodeCommand, args, {
    cwd: path.resolve(__dirname, ".."),
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exitCode = result.status ?? 1;
};

const fetchPlayersForTeam = async (team) => {
  const players = [];

  for (let page = 1; page <= MAX_PLAYER_PAGES; page += 1) {
    const result = await fetchApiFootball("players", {
      page,
      season: WORLD_CUP_SEASON,
      team: team.id,
    });

    const pagePlayers = (result.response ?? []).flatMap((item) => {
      const player = item.player;
      const statistics = item.statistics?.[0];
      if (!player?.id || !player?.name) return [];

      return [{
        active: true,
        external_id: String(player.id),
        name: player.name,
        position: positionFromApi(statistics?.games?.position),
        shirt_number: statistics?.games?.number ?? null,
        source: "api-football",
        team_code: team.code || normalizeTeamCode(team.name),
        team_name: team.name,
      }];
    });

    players.push(...pagePlayers);

    const current = result.paging?.current ?? page;
    const total = result.paging?.total ?? page;
    if (pagePlayers.length === 0 || current >= total) break;
  }

  return players;
};

const main = async () => {
  let teams = [];
  try {
    teams = await fetchTeams();
  } catch (error) {
    console.warn(`API-Football players sync failed: ${error instanceof Error ? error.message : error}`);
    runStaticFallback();
    return;
  }
  if (!teams.length) {
    console.warn("API-Football did not return teams for 2026.");
    runStaticFallback();
    return;
  }
  const limitedTeams = teams.slice(0, MAX_PLAYER_TEAMS);
  const skippedTeams = Math.max(teams.length - limitedTeams.length, 0);
  const allPlayers = [];
  const emptyTeams = [];

  for (const team of limitedTeams) {
    const players = await fetchPlayersForTeam(team);
    if (!players.length) emptyTeams.push(team.name);
    allPlayers.push(...players);
  }

  const uniquePlayers = Array.from(
    new Map(allPlayers.map((player) => [`${player.team_code}:${player.name}`, player])).values(),
  );

  if (dryRun || !uniquePlayers.length) {
    console.log(JSON.stringify({
      dryRun,
      emptyTeams,
      players: uniquePlayers.length,
      requestsUsed: getApiFootballRequestCount(),
      skippedTeams,
      teams: teams.length,
      upserted: 0,
    }, null, 2));
    if (!uniquePlayers.length) {
      console.warn("API-Football did not return players for 2026. Use manual/static players fallback.");
    }
    return;
  }

  const inserted = await rest("players?on_conflict=team_code,name", {
    body: uniquePlayers,
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    method: "POST",
  });

  console.log(JSON.stringify({
    dryRun,
    emptyTeams,
    players: uniquePlayers.length,
    requestsUsed: getApiFootballRequestCount(),
    skippedTeams,
    teams: teams.length,
    upserted: inserted?.length ?? 0,
  }, null, 2));
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
