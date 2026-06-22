// VALIDATE WC2026 PLAYERS
const { getSupabaseServiceKey, getSupabaseUrl } = require("./env.cjs");

const SUPABASE_URL = getSupabaseUrl();
const SUPABASE_SERVICE_KEY = getSupabaseService_KEY();

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
    body: options.body && typeof options.body !== "string" ? JSON.stringify(options.body) : options.body,
  });
  return readJson(response);
};

const isPlaceholderTeam = (teamName) =>
  /^(TBD|Winner |Loser |Runner-up |Third Place )/i.test(String(teamName).trim());

const main = async () => {
  console.log("Validando jogadores WC2026...\n");

  const [matches, players] = await Promise.all([
    rest("matches?select=home_team,away_team&championship=eq.world_cup_2026&deleted_at=is.null"),
    rest("players?select=team_code,team_name,name,position,active&active=eq.true"),
  ]);

  const teams = [...new Set((matches ?? []).flatMap((match) => [match.home_team, match.away_team]).filter(Boolean))]
    .filter((teamName) => !isPlaceholderTeam(teamName))
    .sort();

  const playersByTeam = new Map();
  for (const player of players ?? []) {
    if (!playersByTeam.has(player.team_code)) playersByTeam.set(player.team_code, []);
    playersByTeam.get(player.team_code).push(player);
  }

  let passed = 0;
  let failed = 0;

  // 1. Cada seleção ativa tem jogadores
  for (const teamName of teams) {
    const teamPlayers = players.filter((p) => p.team_name === teamName);
    const hasPlayers = teamPlayers.length > 0;
    console.log(`Seleção ${teamName}: ${hasPlayers ? "PASS" : "FAIL"} (${teamPlayers.length} jogadores)`);
    if (hasPlayers) passed++;
    else failed++;
  }

  // 2. Jogadores têm team_code
  const missingTeamCode = players.filter((p) => !p.team_code).length;
  console.log(`\nJogadores sem team_code: ${missingTeamCode === 0 ? "PASS" : "FAIL"} (${missingTeamCode})`);
  if (missingTeamCode === 0) passed++;
  else failed++;

  // 3. Jogadores têm position
  const missingPosition = players.filter((p) => !p.position).length;
  console.log(`Jogadores sem position: ${missingPosition === 0 ? "PASS" : "FAIL"} (${missingPosition})`);
  if (missingPosition === 0) passed++;
  else failed++;

  // 4. Não existem jogadores com nome vazio
  const emptyNames = players.filter((p) => !p.name || !p.name.trim()).length;
  console.log(`Jogadores com nome vazio: ${emptyNames === 0 ? "PASS" : "FAIL"} (${emptyNames})`);
  if (emptyNames === 0) passed++;
  else failed++;

  // 5. Não existem placeholders
  const placeholders = players.filter((p) => isPlaceholderTeam(p.team_name)).length;
  console.log(`Jogadores de times placeholder: ${placeholders === 0 ? "PASS" : "FAIL"} (${placeholders})`);
  if (placeholders === 0) passed++;
  else failed++;

  console.log(`\nResumo: ${passed} passaram, ${failed} falharam`);

  if (failed > 0) {
    process.exit(1);
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
