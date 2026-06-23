const { getSupabaseServiceKey, getSupabaseUrl, optionalEnv } = require("./env.cjs");
const { calculatePredictionPoints } = require("./lib/prediction-scoring.cjs");

const SUPABASE_URL = getSupabaseUrl();
const SUPABASE_SERVICE_KEY = getSupabaseServiceKey();
const dryRun = process.argv.includes("--dry-run");
const championship = optionalEnv("RECALCULATE_CHAMPIONSHIP", "world_cup_2026");

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

const readStats = (match) => (match.stats && typeof match.stats === "object" ? match.stats : {});

const isMatchFinishedForScoring = (match) => {
  if (match.status === "encerrado") return true;

  const stats = readStats(match);
  const providerStatus = String(stats.espn_status ?? stats.espn_status_detail ?? "").toLowerCase();
  if (providerStatus.includes("final") || providerStatus.includes("post") || providerStatus.includes("encerr")) {
    return true;
  }

  if (stats.has_final_score === true || stats.hasFinalScore === true) {
    return true;
  }

  return false;
};

const isMatchKickoffInPast = (match) => {
  const start = new Date(match.start_time);
  return !Number.isNaN(start.getTime()) && Date.now() > start.getTime();
};

const isMatchProcessableForRecalculate = (match, matchPredictions) => {
  if (isMatchFinishedForScoring(match)) return true;
  if (match.status === "ao_vivo") return false;
  if (!isMatchKickoffInPast(match)) return false;
  return matchPredictions.some(
    (prediction) => prediction.locked === true || Number(prediction.points ?? 0) > 0,
  );
};

const dedupeByKey = (rows, getKey) => {
  const map = new Map();
  for (const row of rows) {
    map.set(getKey(row), row);
  }
  return [...map.values()];
};

const predictionPointsFor = (match, prediction) =>
  calculatePredictionPoints(
    {
      awayScore: Number(match.away_score ?? 0),
      firstGoalNoGoals: match.first_goal_no_goals,
      firstScorer: match.first_goal_scorer,
      firstScorerId: match.first_goal_scorer_id,
      homeScore: Number(match.home_score ?? 0),
      manOfMatch: match.man_of_match,
      manOfMatchId: match.man_of_match_id,
      redCard: match.red_card_happened ?? (Number(match.red_cards_home ?? 0) + Number(match.red_cards_away ?? 0) > 0),
    },
    {
      awayScore: Number(prediction.predicted_away_score ?? 0),
      bothTeamsScore: prediction.predicted_both_teams_score,
      firstGoalNoGoals: prediction.predicted_first_goal_no_goals,
      firstScorer: prediction.predicted_first_scorer,
      firstScorerId: prediction.predicted_first_scorer_id,
      homeScore: Number(prediction.predicted_home_score ?? 0),
      manOfMatch: prediction.predicted_man_of_match,
      manOfMatchId: prediction.predicted_man_of_match_id,
      redCard: prediction.predicted_red_card,
      winner: prediction.predicted_winner,
    },
  );

const main = async () => {
  console.log(`=== Recalculate predictions (${dryRun ? "dry-run" : "live"}) ===`);
  console.log(`Championship: ${championship}\n`);

  const allMatches = await rest(
    `matches?select=*&championship=eq.${championship}&deleted_at=is.null&order=start_time.asc`,
  );
  const allPredictions = await rest("predictions?select=*");
  const predictionsByMatch = new Map();

  for (const prediction of allPredictions ?? []) {
    if (!predictionsByMatch.has(prediction.match_id)) predictionsByMatch.set(prediction.match_id, []);
    predictionsByMatch.get(prediction.match_id).push(prediction);
  }

  const scorableMatches = (allMatches ?? []).filter((match) =>
    isMatchProcessableForRecalculate(match, predictionsByMatch.get(match.id) ?? []),
  );
  const scorableMatchIdSet = new Set(scorableMatches.map((match) => match.id));
  const skippedMatches = (allMatches ?? []).length - scorableMatches.length;
  const skippedReasons = {};

  for (const match of allMatches ?? []) {
    if (scorableMatchIdSet.has(match.id)) continue;
    const reason = match.status === "ao_vivo" ? "live_match" : "not_finished";
    skippedReasons[reason] = (skippedReasons[reason] ?? 0) + 1;
  }

  const scorablePredictions = (allPredictions ?? []).filter((prediction) => scorableMatchIdSet.has(prediction.match_id));

  let predictionsUpdated = 0;

  for (const match of scorableMatches) {
    const matchPredictions = scorablePredictions.filter((prediction) => prediction.match_id === match.id);

    for (const prediction of matchPredictions) {
      const points = predictionPointsFor(match, prediction);
      const needsUpdate = Number(prediction.points ?? 0) !== points || prediction.locked !== true;
      if (!needsUpdate) continue;

      predictionsUpdated += 1;
      prediction.points = points;
      prediction.locked = true;

      if (!dryRun) {
        await rest(`predictions?id=eq.${prediction.id}`, {
          body: JSON.stringify({ locked: true, points }),
          method: "PATCH",
        });
      }
    }
  }

  const matchById = new Map((allMatches ?? []).map((match) => [match.id, match]));
  const [users, rankings] = await Promise.all([
    rest("users?select=id,status,approval_status,blocked,deleted_at&deleted_at=is.null"),
    rest("rankings?select=user_id,total_points,correct_results,exact_scores"),
  ]);

  const rankingByUser = new Map((rankings ?? []).map((ranking) => [ranking.user_id, ranking]));
  const predictionsByUser = new Map();

  for (const prediction of allPredictions ?? []) {
    if (!predictionsByUser.has(prediction.user_id)) predictionsByUser.set(prediction.user_id, []);
    predictionsByUser.get(prediction.user_id).push(prediction);
  }

  const changed = [];
  for (const user of users ?? []) {
    const status = user.status ?? (user.blocked ? "suspended" : user.approval_status);
    if (status !== "approved" || user.blocked) continue;

    const userPredictions = predictionsByUser.get(user.id) ?? [];
    const totalPoints = userPredictions.reduce((sum, prediction) => sum + Number(prediction.points ?? 0), 0);
    const correctResults = userPredictions.filter((prediction) => Number(prediction.points ?? 0) > 0).length;
    const exactScores = userPredictions.filter((prediction) => {
      const match = matchById.get(prediction.match_id);
      return Boolean(
        match
        && match.status === "encerrado"
        && Number(prediction.predicted_home_score) === Number(match.home_score)
        && Number(prediction.predicted_away_score) === Number(match.away_score),
      );
    }).length;
    const current = rankingByUser.get(user.id);

    if (
      current
      && Number(current.total_points ?? 0) === totalPoints
      && Number(current.correct_results ?? 0) === correctResults
      && Number(current.exact_scores ?? 0) === exactScores
    ) {
      continue;
    }

    changed.push({
      correct_results: correctResults,
      exact_scores: exactScores,
      total_points: totalPoints,
      updated_at: new Date().toISOString(),
      user_id: user.id,
    });
  }

  if (changed.length && !dryRun) {
    const rankingPayload = dedupeByKey(changed, (row) => row.user_id);
    await rest("rankings?on_conflict=user_id", {
      body: JSON.stringify(rankingPayload),
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      method: "POST",
    });
  }

  const message = `Pontuacao recalculada: ${scorableMatches.length} jogos encerrados; ${predictionsUpdated} palpites recalculados; ${changed.length} rankings atualizados.`;

  console.log("Report:");
  console.log(`- totalMatches: ${(allMatches ?? []).length}`);
  console.log(`- finishedMatches: ${scorableMatches.length}`);
  console.log(`- predictionsFound: ${scorablePredictions.length}`);
  console.log(`- predictionsUpdated: ${predictionsUpdated}`);
  console.log(`- rankingsUpdated: ${changed.length}`);
  console.log(`- skippedMatches: ${skippedMatches}`);
  console.log(`- skippedReason: ${JSON.stringify(skippedReasons)}`);
  console.log(`\n${message}`);

  if (!dryRun) {
    try {
      await rest("match_provider_runs", {
        body: JSON.stringify({
          inserted_count: 0,
          message,
          provider_name: "recalculate-predictions",
          status: "success",
          updated_count: predictionsUpdated,
        }),
        method: "POST",
      });
    } catch (logError) {
      console.warn("Nao foi possivel registrar log administrativo:", logError instanceof Error ? logError.message : logError);
    }
  }
};

main().catch((error) => {
  console.error("Recalculate failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
