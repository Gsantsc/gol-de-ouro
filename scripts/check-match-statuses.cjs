// Check match statuses to identify incorrect ao_vivo assignments
const { getSupabaseServiceKey, getSupabaseUrl } = require("./env.cjs");

const SUPABASE_URL = getSupabaseUrl();
const SUPABASE_SERVICE_KEY = getSupabaseServiceKey();

const headers = {
  apikey: SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
  "Content-Type": "application/json",
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

const main = async () => {
  console.log("=== Checking match statuses ===\n");

  const matches = await rest("matches?select=id,home_team,away_team,start_time,status&deleted_at=is.null&order=start_time.asc");
  
  const now = new Date();
  const statusCounts = {};
  const futureMatchesAoVivo = [];
  const pastMatchesNotEncerrado = [];
  
  for (const match of matches ?? []) {
    statusCounts[match.status] = (statusCounts[match.status] ?? 0) + 1;
    
    const start = new Date(match.start_time);
    const isFuture = now < start;
    const isPast = now > start;
    
    if (isFuture && match.status === "ao_vivo") {
      futureMatchesAoVivo.push({
        match: `${match.home_team} x ${match.away_team}`,
        start_time: match.start_time,
        status: match.status
      });
    }
    
    if (isPast && match.status !== "encerrado" && match.status !== "ao_vivo") {
      pastMatchesNotEncerrado.push({
        match: `${match.home_team} x ${match.away_team}`,
        start_time: match.start_time,
        status: match.status
      });
    }
  }
  
  console.log("Status counts:");
  for (const [status, count] of Object.entries(statusCounts)) {
    console.log(`  ${status}: ${count}`);
  }
  
  console.log(`\nFuture matches marked as ao_vivo: ${futureMatchesAoVivo.length}`);
  for (const item of futureMatchesAoVivo) {
    console.log(`  - ${item.match} (${item.start_time})`);
  }
  
  console.log(`\nPast matches not encerrado: ${pastMatchesNotEncerrado.length}`);
  for (const item of pastMatchesNotEncerrado) {
    console.log(`  - ${item.match} (${item.start_time}) - status: ${item.status}`);
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
