// Audit script to check for invalid prediction players
// Usage: node scripts/audit-invalid-prediction-players.cjs [--fix]

const { getSupabaseUrl, getSupabaseServiceKey } = require("./env.cjs");

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
    body: options.body && typeof options.body !== "string" ? JSON.stringify(options.body) : options.body,
  });
  return readJson(response);
};

const normalizeTeamName = (value) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const teamAliases = {
  "brasil": "brazil",
  "brazil": "brazil",
  "estados unidos": "united states",
  "united states": "united states",
  "usa": "united states",
  "usmnt": "united states",
  "países baixos": "netherlands",
  "netherlands": "netherlands",
  "holanda": "netherlands",
  "japão": "japan",
  "japan": "japan",
  "espanha": "spain",
  "spain": "spain",
  "arábia saudita": "saudi arabia",
  "saudi arabia": "saudi arabia",
  "bélgica": "belgium",
  "belgium": "belgium",
  "irã": "iran",
  "iran": "iran",
  "frança": "france",
  "france": "france",
  "iraque": "iraq",
  "iraq": "iraq",
  "portugal": "portugal",
  "uzbequistão": "uzbekistan",
  "uzbekistan": "uzbekistan",
  "austrália": "australia",
  "australia": "australia",
  "tunísia": "tunisia",
  "tunisia": "tunisia",
  "suécia": "sweden",
  "sweden": "sweden",
};

const normalizeTeamNameWithAliases = (value) => {
  const normalized = normalizeTeamName(value);
  return teamAliases[normalized] ?? normalized;
};

const isPlayerEligibleForMatch = (player, match) => {
  const playerTeamNormalized = normalizeTeamNameWithAliases(player.team_name);
  const homeTeamNormalized = normalizeTeamName(match.home_team);
  const awayTeamNormalized = normalizeTeamName(match.away_team);

  if (player.team_code) {
    const playerCodeNormalized = normalizeTeamName(player.team_code);
    const homeCodeNormalized = normalizeTeamName(match.home_team);
    const awayCodeNormalized = normalizeTeamName(match.away_team);

    if (playerCodeNormalized === homeCodeNormalized || playerCodeNormalized === awayCodeNormalized) {
      return true;
    }
  }

  return playerTeamNormalized === homeTeamNormalized || playerTeamNormalized === awayTeamNormalized;
};

const main = async () => {
  const fix = process.argv.includes("--fix");
  console.log(fix ? "🔧 Modo de correção ativado" : "🔍 Modo de auditoria (dry-run)");

  console.log("📊 Buscando predictions...");
  const predictions = await rest("predictions?select=id,user_id,match_id,predicted_first_scorer_id,predicted_man_of_match_id");
  console.log(`✅ Encontradas ${predictions.length} predictions`);

  console.log("📊 Buscando matches...");
  const matches = await rest("matches?select=id,home_team,away_team");
  console.log(`✅ Encontrados ${matches.length} matches`);

  console.log("📊 Buscando players...");
  const players = await rest("players?select=id,team_code,team_name");
  console.log(`✅ Encontrados ${players.length} players`);

  const matchById = new Map(matches.map((m) => [m.id, m]));
  const playerById = new Map(players.map((p) => [p.id, p]));

  let invalidFirstScorerCount = 0;
  let invalidMvpCount = 0;
  const examples = [];

  console.log("🔍 Analisando predictions...");
  for (const prediction of predictions) {
    const match = matchById.get(prediction.match_id);
    if (!match) continue;

    if (prediction.predicted_first_scorer_id) {
      const player = playerById.get(prediction.predicted_first_scorer_id);
      if (player && !isPlayerEligibleForMatch(player, match)) {
        invalidFirstScorerCount++;
        if (examples.length < 5) {
          examples.push({
            predictionId: prediction.id,
            match: `${match.home_team} x ${match.away_team}`,
            player: player.name,
            playerTeam: player.team_name,
            field: "predicted_first_scorer_id"
          });
        }
      }
    }

    if (prediction.predicted_man_of_match_id) {
      const player = playerById.get(prediction.predicted_man_of_match_id);
      if (player && !isPlayerEligibleForMatch(player, match)) {
        invalidMvpCount++;
        if (examples.length < 5) {
          examples.push({
            predictionId: prediction.id,
            match: `${match.home_team} x ${match.away_team}`,
            player: player.name,
            playerTeam: player.team_name,
            field: "predicted_man_of_match_id"
          });
        }
      }
    }
  }

  console.log("\n📋 RELATÓRIO DE AUDITORIA");
  console.log("================================");
  console.log(`Total de predictions verificadas: ${predictions.length}`);
  console.log(`Primeiro gol inválido: ${invalidFirstScorerCount}`);
  console.log(`MVP inválido: ${invalidMvpCount}`);
  console.log(`Total de campos inválidos: ${invalidFirstScorerCount + invalidMvpCount}`);

  if (examples.length > 0) {
    console.log("\n📌 EXEMPLOS:");
    examples.forEach((ex) => {
      console.log(`  • ${ex.match}: ${ex.player} (${ex.playerTeam}) - ${ex.field}`);
    });
  }

  if (fix && (invalidFirstScorerCount > 0 || invalidMvpCount > 0)) {
    console.log("\n🔧 Corrigindo predictions inválidas...");
    let fixedCount = 0;

    for (const prediction of predictions) {
      const match = matchById.get(prediction.match_id);
      if (!match) continue;

      const updates = {};
      let needsUpdate = false;

      if (prediction.predicted_first_scorer_id) {
        const player = playerById.get(prediction.predicted_first_scorer_id);
        if (player && !isPlayerEligibleForMatch(player, match)) {
          updates.predicted_first_scorer_id = null;
          needsUpdate = true;
        }
      }

      if (prediction.predicted_man_of_match_id) {
        const player = playerById.get(prediction.predicted_man_of_match_id);
        if (player && !isPlayerEligibleForMatch(player, match)) {
          updates.predicted_man_of_match_id = null;
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        const updateFields = [];
        if (updates.predicted_first_scorer_id !== undefined) {
          updateFields.push(`predicted_first_scorer_id = NULL`);
        }
        if (updates.predicted_man_of_match_id !== undefined) {
          updateFields.push(`predicted_man_of_match_id = NULL`);
        }

        console.log(`-- Prediction ${prediction.id}: ${match.home_team} x ${match.away_team}`);
        console.log(`UPDATE predictions SET ${updateFields.join(", ")} WHERE id = '${prediction.id}';`);
        fixedCount++;
      }
    }

    console.log(`✅ ${fixedCount} predictions corrigidas`);
  }

  console.log("\n✅ Auditoria concluída");
};

main().catch((error) => {
  console.error("❌ Erro:", error);
  process.exit(1);
});
