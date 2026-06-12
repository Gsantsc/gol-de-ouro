const { getSupabaseServiceKey, getSupabaseUrl, optionalEnv } = require("./env.cjs");

const SUPABASE_URL = getSupabaseUrl();
const SUPABASE_SERVICE_KEY = getSupabaseServiceKey();
const dryRun = process.argv.includes("--dry-run");
const now = new Date(optionalEnv("LIVE_RESULTS_NOW", new Date().toISOString()));
const championship = optionalEnv("LIVE_RESULTS_CHAMPIONSHIP", "world_cup_2026");
const resultProvider = optionalEnv("LIVE_RESULTS_PROVIDER", "none");

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

const predictionWindowPayload = (startTime) => {
  const startAt = new Date(startTime);
  return {
    prediction_close_at: new Date(startAt.getTime() - 60 * 60 * 1000).toISOString(),
    prediction_open_at: new Date(startAt.getTime() - 24 * 60 * 60 * 1000).toISOString(),
  };
};

const calculateMatchStatus = (match) => {
  if (match.status === "encerrado") return "encerrado";
  const window = predictionWindowPayload(match.start_time);
  const openAt = new Date(window.prediction_open_at);
  const closeAt = new Date(window.prediction_close_at);
  if (now < openAt) return "fechado";
  if (now < closeAt) return "aberto";
  return "ao_vivo";
};

const shouldCheckLiveResult = (match) => {
  if (match.status === "encerrado") return false;
  const startAt = new Date(match.start_time);
  if (Number.isNaN(startAt.getTime())) return false;
  return now >= new Date(startAt.getTime() - 2 * 60 * 60 * 1000)
    && now <= new Date(startAt.getTime() + 4 * 60 * 60 * 1000);
};

const nextLiveSyncAt = (match) => {
  if (match.status === "encerrado") return null;
  const startAt = new Date(match.start_time);
  if (Number.isNaN(startAt.getTime())) return new Date(now.getTime() + 60 * 60 * 1000).toISOString();
  if (now < new Date(startAt.getTime() - 2 * 60 * 60 * 1000)) {
    return new Date(startAt.getTime() - 2 * 60 * 60 * 1000).toISOString();
  }
  if (now < new Date(startAt.getTime() + 4 * 60 * 60 * 1000)) {
    return new Date(now.getTime() + 5 * 60 * 1000).toISOString();
  }
  return new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString();
};

const fetchLiveResult = async (match) => {
  if (resultProvider === "none") return null;
  return {
    error: `Provider ${resultProvider} ainda nao possui adapter seguro configurado para resultados finais.`,
    matchId: match.id,
  };
};

const listMatches = () => rest(`matches?select=*&championship=eq.${championship}&deleted_at=is.null&order=start_time.asc`);

const patchMatch = async (match, payload) => {
  if (dryRun) return;
  await rest(`matches?id=eq.${match.id}`, {
    body: JSON.stringify(payload),
    method: "PATCH",
  });
};

const patchQueue = async (match, payload) => {
  if (dryRun) return;
  try {
    await rest(`match_sync_queue?match_id=eq.${match.id}&provider=eq.live-results`, {
      body: JSON.stringify(payload),
      method: "PATCH",
    });
  } catch (_error) {
    // The queue is created by a migration. Older databases can still run status sync safely.
  }
};

const run = async () => {
  const matches = await listMatches();
  const updates = [];
  const providerWarnings = [];

  for (const match of matches ?? []) {
    const window = predictionWindowPayload(match.start_time);
    const localStatus = calculateMatchStatus(match);
    const providerResult = shouldCheckLiveResult(match) ? await fetchLiveResult(match) : null;
    if (providerResult?.error) providerWarnings.push(providerResult.error);

    const nextPayload = {
      prediction_close_at: window.prediction_close_at,
      prediction_open_at: window.prediction_open_at,
      status: localStatus,
    };

    const changed = match.status !== nextPayload.status
      || new Date(match.prediction_close_at).toISOString() !== nextPayload.prediction_close_at
      || new Date(match.prediction_open_at).toISOString() !== nextPayload.prediction_open_at;

    if (changed) {
      await patchMatch(match, nextPayload);
      updates.push({ from: match.status, id: match.id, name: `${match.home_team} x ${match.away_team}`, to: nextPayload.status });
    }

    await patchQueue(match, {
      error_message: providerResult?.error ?? null,
      last_sync_at: now.toISOString(),
      next_sync_at: nextLiveSyncAt({ ...match, status: nextPayload.status }),
      sync_status: providerResult?.error ? "failed" : "success",
    });
  }

  console.log(JSON.stringify({
    championship,
    dryRun,
    matchesChecked: matches?.length ?? 0,
    now: now.toISOString(),
    provider: resultProvider,
    providerWarnings: [...new Set(providerWarnings)],
    statusUpdates: updates,
    statusUpdatesCount: updates.length,
  }, null, 2));
};

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
