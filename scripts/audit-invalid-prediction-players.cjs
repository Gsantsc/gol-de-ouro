// Audit script to check for invalid prediction players
// Usage: node scripts/audit-invalid-prediction-players.cjs [--fix]

const { createClient } = require("@supabase/supabase-js");
const requiredEnv = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Variável ${name} não configurada.`);
  return value;
};

const supabase = createClient(requiredEnv("NEXT_PUBLIC_SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"));

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
  const { data: predictions, error: predictionsError } = await supabase
    .from("predictions")
    .select("id, user_id, match_id, predicted_first_scorer_id, predicted_man_of_match_id")
    .is("deleted_at", null);

  if (predictionsError) throw predictionsError;
  console.log(`✅ Encontradas ${predictions.length} predictions`);

  console.log("📊 Buscando matches...");
  const { data: matches, error: matchesError } = await supabase
    .from("matches")
    .select("id, home_team, away_team")
    .is("deleted_at", null);

  if (matchesError) throw matchesError;
  console.log(`✅ Encontrados ${matches.length} matches`);

  console.log("📊 Buscando players...");
  const { data: players, error: playersError } = await supabase
    .from("players")
    .select("id, team_code, team_name")
    .is("deleted_at", null);

  if (playersError) throw playersError;
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
        const { error } = await supabase
          .from("predictions")
          .update(updates)
          .eq("id", prediction.id);

        if (error) {
          console.error(`❌ Erro ao corrigir prediction ${prediction.id}:`, error.message);
        } else {
          fixedCount++;
        }
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
