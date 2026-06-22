// Fix match statuses - remove incorrect ao_vivo status
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
  console.log("=== Fixing match statuses ===\n");

  const matches = await rest("matches?select=id,home_team,away_team,start_time,status&deleted_at=is.null");
  
  const now = new Date();
  let updated = 0;
  
  for (const match of matches ?? []) {
    if (match.status !== "ao_vivo") continue;
    
    const start = new Date(match.start_time);
    const liveWindowEndsAt = new Date(start.getTime() + 180 * 60 * 1000);
    
    // Check if match is actually within live window
    if (now < start || now > liveWindowEndsAt) {
      console.log(`Updating ${match.home_team} x ${match.away_team} from ao_vivo to fechado`);
      await rest(`matches?id=eq.${match.id}`, {
        body: JSON.stringify({ status: "fechado" }),
        method: "PATCH",
      });
      updated++;
    }
  }
  
  console.log(`\nUpdated ${updated} matches from ao_vivo to aguardando`);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
