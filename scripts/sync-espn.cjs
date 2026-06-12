const { getSupabaseServiceKey, getSupabaseUrl, optionalEnv } = require("./env.cjs");

const SUPABASE_URL = getSupabaseUrl();
const SUPABASE_SERVICE_KEY = getSupabaseServiceKey();
const ESPN_BASE_URL = optionalEnv("ESPN_SCOREBOARD_URL", "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard");
const ESPN_DATE = optionalEnv("ESPN_SCOREBOARD_DATE", new Date().toISOString().slice(0, 10).replaceAll("-", ""));
const dryRun = process.argv.includes("--dry-run");

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

const rest = async (path, options = {}) => readJson(await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...options, headers: { ...headers, ...options.headers } }));
const normalizeTeam = (value) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, " ").trim().toLowerCase().replace(/^south korea$/, "korea republic").replace(/^usa$/, "united states");
const sameKickoffWindow = (left, right) => Math.abs(new Date(left).getTime() - new Date(right).getTime()) <= 8 * 60 * 60 * 1000;
const looseKickoffWindow = (left, right) => Math.abs(new Date(left).getTime() - new Date(right).getTime()) <= 36 * 60 * 60 * 1000;

const mapStatus = (status) => {
  const type = status?.type;
  if (type?.completed || type?.name === "STATUS_FULL_TIME") return "encerrado";
  if (type?.state === "in") return "ao_vivo";
  return null;
};

const readTeam = (competitors, side) => {
  const item = competitors?.find((competitor) => competitor.homeAway === side);
  return {
    logo: item?.team?.logo ?? null,
    name: item?.team?.displayName ?? item?.team?.shortDisplayName ?? item?.team?.name ?? "TBD",
    score: Number(item?.score ?? 0),
  };
};

const fetchEspnEvents = async () => {
  const url = new URL(ESPN_BASE_URL);
  url.searchParams.set("dates", ESPN_DATE);
  const json = await readJson(await fetch(url, { signal: AbortSignal.timeout(20000) }));
  return (json.events ?? []).map((event) => {
    const competition = event.competitions?.[0];
    return {
      away: readTeam(competition?.competitors, "away"),
      date: event.date,
      eventId: event.id,
      home: readTeam(competition?.competitors, "home"),
      rawStatusName: competition?.status?.type?.name ?? event.status?.type?.name ?? null,
      status: mapStatus(competition?.status ?? event.status),
      venue: competition?.venue?.fullName ?? event.venue?.displayName ?? null,
    };
  }).filter((event) => event.eventId && event.date);
};

const findMatch = (matches, event) => {
  const byMappedId = matches.find((match) => String(match.stats?.espn_event_id ?? "") === event.eventId);
  if (byMappedId) return byMappedId;
  const exact = matches.find((match) => sameKickoffWindow(match.start_time, event.date) && normalizeTeam(match.home_team) === normalizeTeam(event.home.name) && normalizeTeam(match.away_team) === normalizeTeam(event.away.name));
  if (exact) return exact;
  return matches.find((match) => looseKickoffWindow(match.start_time, event.date) && (
    normalizeTeam(match.home_team) === normalizeTeam(event.home.name)
    || normalizeTeam(match.away_team) === normalizeTeam(event.away.name)
    || normalizeTeam(match.home_team) === normalizeTeam(event.away.name)
    || normalizeTeam(match.away_team) === normalizeTeam(event.home.name)
  ));
};

const updateStandings = async (matches) => {
  const tournamentId = matches[0]?.tournament_id;
  if (!tournamentId) return 0;
  const table = new Map();
  const ensure = (group, name) => {
    const key = `${group}:${name}`;
    if (!table.has(key)) table.set(key, { drawn: 0, form: [], ga: 0, gf: 0, group, lost: 0, name, played: 0, points: 0, won: 0 });
    return table.get(key);
  };
  for (const match of matches) {
    const group = match.stats?.group;
    if (!group || match.status !== "encerrado") continue;
    const home = ensure(group, match.home_team);
    const away = ensure(group, match.away_team);
    const hs = Number(match.home_score ?? 0);
    const as = Number(match.away_score ?? 0);
    home.played += 1; away.played += 1;
    home.gf += hs; home.ga += as; away.gf += as; away.ga += hs;
    if (hs > as) { home.won += 1; home.points += 3; home.form.push("W"); away.lost += 1; away.form.push("L"); }
    else if (as > hs) { away.won += 1; away.points += 3; away.form.push("W"); home.lost += 1; home.form.push("L"); }
    else { home.drawn += 1; away.drawn += 1; home.points += 1; away.points += 1; home.form.push("D"); away.form.push("D"); }
  }
  const rows = [...table.values()].sort((a, b) => a.group.localeCompare(b.group) || b.points - a.points || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || a.name.localeCompare(b.name)).map((team, index, all) => ({
    drawn: team.drawn,
    form: team.form.slice(-5).join(""),
    goal_difference: team.gf - team.ga,
    goals_against: team.ga,
    goals_for: team.gf,
    group_code: team.group,
    lost: team.lost,
    played: team.played,
    points: team.points,
    position: all.slice(0, index).filter((entry) => entry.group === team.group).length + 1,
    team_name: team.name,
    tournament_id: tournamentId,
    won: team.won,
  }));
  if (!rows.length || dryRun) return rows.length;
  await rest("standings?on_conflict=tournament_id,team_name", { body: JSON.stringify(rows), headers: { Prefer: "resolution=merge-duplicates,return=representation" }, method: "POST" });
  return rows.length;
};

const run = async () => {
  const events = await fetchEspnEvents();
  const matches = await rest("matches?select=*&championship=eq.world_cup_2026&deleted_at=is.null&order=start_time.asc");
  const updates = [];
  const skipped = [];
  for (const event of events) {
    const match = findMatch(matches, event);
    if (!match) { skipped.push({ eventId: event.eventId, name: `${event.home.name} x ${event.away.name}` }); continue; }
    const status = event.status ?? match.status;
    const payload = {
      away_score: event.away.score,
      away_team: event.away.name,
      away_team_logo_url: event.away.logo,
      home_score: event.home.score,
      home_team: event.home.name,
      home_team_logo_url: event.home.logo,
      last_synced_at: new Date().toISOString(),
      start_time: event.date,
      live_score: { away: event.away.score, home: event.home.score },
      stadium: event.venue ?? match.stadium,
      stats: { ...(match.stats ?? {}), espn_event_id: event.eventId, espn_status: event.rawStatusName },
      status,
    };
    if (!dryRun) await rest(`matches?id=eq.${match.id}`, { body: JSON.stringify(payload), method: "PATCH" });
    if (!dryRun && status === "encerrado" && match.status !== "encerrado") await rest("rpc/finish_match_and_score", { body: JSON.stringify({ target_match_id: match.id }), method: "POST" });
    Object.assign(match, payload);
    updates.push({ eventId: event.eventId, matchId: match.id, score: `${event.home.score}x${event.away.score}`, status, teams: `${match.home_team} x ${match.away_team}` });
  }
  const standingsSynced = await updateStandings(matches);
  if (!dryRun) await rest("match_provider_runs", { body: JSON.stringify({ inserted_count: 0, message: `ESPN job: ${updates.length} jogos atualizados.`, provider_name: "espn", status: "success", updated_count: updates.length }), method: "POST" });
  console.log(JSON.stringify({ date: ESPN_DATE, dryRun, events: events.length, provider: "espn", skipped, standingsSynced, updated: updates, updatedCount: updates.length }, null, 2));
};

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
