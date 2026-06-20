const { getSupabaseServiceKey, getSupabaseUrl, optionalEnv } = require("./env.cjs");
const { buildWorldCup2026Dataset } = require("./world-cup-2026-dataset.cjs");

const SUPABASE_URL = getSupabaseUrl();
const SUPABASE_SERVICE_KEY = getSupabaseServiceKey();
const dryRun = process.argv.includes("--dry-run");
const now = new Date(optionalEnv("WORLD_CUP_IMPORT_NOW", new Date().toISOString()));

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

const calculateStatus = (match) => {
  const openAt = new Date(match.prediction_open_at);
  const closeAt = new Date(match.prediction_close_at);
  if (now < openAt) return "fechado";
  if (now < closeAt) return "aberto";
  return "ao_vivo";
};

const ensureTournament = async (dataset) => {
  const existing = await rest(`tournaments?select=id,name,slug&type=eq.world_cup&slug=eq.${dataset.championship}&limit=1`);
  if (existing?.[0]) return existing[0];
  if (dryRun) return { id: "dry-run-world-cup-2026", name: dataset.tournamentName, slug: dataset.championship };

  const created = await rest("tournaments", {
    body: JSON.stringify({ active: true, name: dataset.tournamentName, slug: dataset.championship, type: "world_cup" }),
    method: "POST",
  });
  return created[0];
};

const findExistingMatch = async (providerName, providerExternalId, matchNumber, championship) => {
  const rows = await rest(`matches?select=*&provider_name=eq.${providerName}&provider_external_id=eq.${encodeURIComponent(providerExternalId)}&limit=1`);
  if (rows?.[0]) return rows[0];

  const byNumber = await rest(
    `matches?select=*&provider_name=eq.${providerName}&championship=eq.${championship}&stats->>match_number=eq.${matchNumber}&limit=1`,
  );
  return byNumber?.[0] ?? null;
};

const upsertMatch = async ({ dataset, match, tournamentId }) => {
  const existing = await findExistingMatch(dataset.providerName, match.providerExternalId, match.matchNumber, dataset.championship);
  const preserveOfficialResult = existing?.status === "encerrado";
  const homeScore = preserveOfficialResult ? existing.home_score : Number(existing?.home_score ?? 0);
  const awayScore = preserveOfficialResult ? existing.away_score : Number(existing?.away_score ?? 0);
  const payload = {
    away_score: awayScore,
    away_team: match.awayTeam,
    championship: dataset.championship,
    home_score: homeScore,
    home_team: match.homeTeam,
    last_synced_at: new Date().toISOString(),
    live_score: preserveOfficialResult ? existing.live_score : { away: awayScore, home: homeScore },
    prediction_close_at: match.prediction_close_at,
    prediction_open_at: match.prediction_open_at,
    provider_external_id: match.providerExternalId,
    provider_name: dataset.providerName,
    round: match.round,
    stadium: match.stadium,
    start_time: match.startTime,
    start_time_utc: match.kickoffUtc ?? match.startTime,
    status: preserveOfficialResult ? "encerrado" : calculateStatus(match),
    venue_timezone: match.venueTimezone,
    source_timezone: match.venueTimezone,
    kickoff_source: match.source ?? "espn_fifa_world_cup_scoreboard",
    kickoff_verified_at: new Date().toISOString(),
    display_time_br: match.kickoffBrt ?? null,
    stats: {
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
    },
    tournament_id: tournamentId,
  };

  if (dryRun) {
    return { action: existing ? "update" : "insert", id: existing?.id ?? `dry-run-match-${match.matchNumber}`, payload };
  }

  if (existing) {
    const saved = await rest(`matches?id=eq.${existing.id}`, {
      body: JSON.stringify(payload),
      method: "PATCH",
    });
    return { action: "update", id: saved[0].id, payload: saved[0] };
  }

  const saved = await rest("matches", {
    body: JSON.stringify(payload),
    method: "POST",
  });
  return { action: "insert", id: saved[0].id, payload: saved[0] };
};

const upsertQueueItem = async ({ matchId, provider, startTime }) => {
  const startAt = new Date(startTime);
  const payload = {
    match_id: matchId,
    next_sync_at: new Date(startAt.getTime() - 2 * 60 * 60 * 1000).toISOString(),
    provider,
    sync_status: "pending",
  };
  if (dryRun) return { skipped: false, payload };

  try {
    const existing = await rest(`match_sync_queue?select=id&match_id=eq.${matchId}&provider=eq.${provider}&limit=1`);
    if (existing?.[0]) {
      await rest(`match_sync_queue?id=eq.${existing[0].id}`, {
        body: JSON.stringify(payload),
        method: "PATCH",
      });
      return { skipped: false, payload };
    }

    await rest("match_sync_queue", {
      body: JSON.stringify(payload),
      method: "POST",
    });
    return { skipped: false, payload };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error), skipped: true };
  }
};
const run = async () => {
  const dataset = buildWorldCup2026Dataset();
  if (dataset.matches.length !== 104) throw new Error(`Dataset invalido: esperado 104 jogos, recebeu ${dataset.matches.length}.`);
  if (dataset.teams.length !== 48) throw new Error(`Dataset invalido: esperado 48 selecoes, recebeu ${dataset.teams.length}.`);
  if (dataset.groups.length !== 12) throw new Error(`Dataset invalido: esperado 12 grupos, recebeu ${dataset.groups.length}.`);

  const tournament = await ensureTournament(dataset);
  const imported = [];
  const queue = [];

  for (const match of dataset.matches) {
    const saved = await upsertMatch({ dataset, match, tournamentId: tournament.id });
    imported.push({
      action: saved.action,
      id: saved.id,
      matchNumber: match.matchNumber,
      name: `${match.homeTeam} x ${match.awayTeam}`,
    });
    queue.push(await upsertQueueItem({ matchId: saved.id, provider: "live-results", startTime: match.startTime }));
  }

  const queueSkipped = queue.filter((item) => item.skipped).length;
  console.log(JSON.stringify({
    dryRun,
    groups: dataset.groups.length,
    imported: imported.length,
    inserted: imported.filter((item) => item.action === "insert").length,
    matches: dataset.matches.length,
    now: now.toISOString(),
    providerName: dataset.providerName,
    queuePrepared: queue.length - queueSkipped,
    queueSkipped,
    sample: imported.slice(0, 5),
    teams: dataset.teams.length,
    tournament: tournament.slug ?? tournament.name,
  }, null, 2));
};

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
