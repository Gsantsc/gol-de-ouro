const {
  getSupabaseServiceKey,
  getSupabaseUrl,
  optionalEnv,
} = require("./env.cjs");

const SUPABASE_URL = getSupabaseUrl();
const SUPABASE_SERVICE_KEY = getSupabaseServiceKey();
const WORLD_CUP_CHAMPIONSHIP = "world_cup_2026";
const HOUR_MS = 60 * 60 * 1000;
const dryRun = process.argv.includes("--dry-run");
const championship = optionalEnv("MATCH_JOB_CHAMPIONSHIP", WORLD_CUP_CHAMPIONSHIP);

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
    headers: {
      ...headers,
      ...options.headers,
    },
  });

  return readJson(response);
};

const calculatePredictionWindow = (startTime) => {
  const startAt = new Date(startTime);
  return {
    prediction_close_at: new Date(startAt.getTime() - HOUR_MS).toISOString(),
    prediction_open_at: new Date(startAt.getTime() - 24 * HOUR_MS).toISOString(),
  };
};

const toIso = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
};

// MATCH STATUS ENGINE
const calculateMatchStatus = (match, now = new Date()) => {
  if (match.status === "encerrado") return "encerrado";

  const windowPayload = calculatePredictionWindow(match.start_time);
  const openAt = new Date(windowPayload.prediction_open_at);
  const closeAt = new Date(windowPayload.prediction_close_at);

  if (now < openAt) return "fechado";
  if (now < closeAt) return "aberto";
  return "ao_vivo";
};

const outcome = ({ awayScore, homeScore }) => {
  if (homeScore > awayScore) return "home";
  if (awayScore > homeScore) return "away";
  return "draw";
};

const normalizeMarketText = (value) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized || null;
};

// SCORING ENGINE
const calculatePredictionPoints = (match, prediction) => {
  const official = {
    awayScore: Number(match.away_score ?? 0),
    firstScorer: match.first_goal_scorer,
    firstScorerId: match.first_goal_scorer_id,
    firstGoalNoGoals: match.first_goal_no_goals,
    homeScore: Number(match.home_score ?? 0),
    manOfMatch: match.man_of_match,
    manOfMatchId: match.man_of_match_id,
    redCard: match.red_card_happened ?? (Number(match.red_cards_home ?? 0) + Number(match.red_cards_away ?? 0) > 0),
  };
  const guessed = {
    awayScore: Number(prediction.predicted_away_score ?? 0),
    bothTeamsScore: prediction.predicted_both_teams_score,
    firstScorer: prediction.predicted_first_scorer,
    firstScorerId: prediction.predicted_first_scorer_id,
    firstGoalNoGoals: prediction.predicted_first_goal_no_goals,
    homeScore: Number(prediction.predicted_home_score ?? 0),
    manOfMatch: prediction.predicted_man_of_match,
    manOfMatchId: prediction.predicted_man_of_match_id,
    redCard: prediction.predicted_red_card,
    winner: prediction.predicted_winner,
  };
  const exact = official.homeScore === guessed.homeScore && official.awayScore === guessed.awayScore;
  const sameOutcome = outcome(official) === (guessed.winner ?? outcome(guessed));
  const sameGoalDifference = official.homeScore - official.awayScore === guessed.homeScore - guessed.awayScore;
  const firstScorer =
    (official.firstGoalNoGoals === true && guessed.firstGoalNoGoals === true)
    || (
      official.firstScorerId != null
      && guessed.firstScorerId != null
      && official.firstScorerId === guessed.firstScorerId
    )
    || (
      official.firstScorerId == null
      && guessed.firstScorerId == null
      && normalizeMarketText(official.firstScorer) !== null
      && normalizeMarketText(official.firstScorer) === normalizeMarketText(guessed.firstScorer)
    );
  const bothTeamsScore =
    guessed.bothTeamsScore !== null
    && guessed.bothTeamsScore !== undefined
    && guessed.bothTeamsScore === (official.homeScore > 0 && official.awayScore > 0);
  const manOfMatch =
    (
      official.manOfMatchId != null
      && guessed.manOfMatchId != null
      && official.manOfMatchId === guessed.manOfMatchId
    )
    || (
      official.manOfMatchId == null
      && guessed.manOfMatchId == null
      && normalizeMarketText(official.manOfMatch) !== null
      && normalizeMarketText(official.manOfMatch) === normalizeMarketText(guessed.manOfMatch)
    );
  const redCard =
    guessed.redCard !== null
    && guessed.redCard !== undefined
    && official.redCard !== null
    && official.redCard !== undefined
    && guessed.redCard === official.redCard;

  let points = 0;
  if (exact) points += 10;
  if (sameOutcome) points += 5;
  if (sameGoalDifference) points += 3;
  if (firstScorer) points += 8;
  if (bothTeamsScore) points += 2;
  if (manOfMatch) points += 6;
  if (redCard) points += 2;
  if (exact && firstScorer) points += 10;
  if (exact && sameOutcome && sameGoalDifference && firstScorer && bothTeamsScore && manOfMatch && redCard) {
    points += 20;
  }

  return points;
};

const listWorldCupTournamentIds = async () => {
  const tournaments = await rest(`tournaments?select=id,slug&type=eq.world_cup`);
  return new Set(
    (tournaments ?? [])
      .filter((tournament) => tournament.slug === championship || tournament.slug === "world_cup")
      .map((tournament) => tournament.id),
  );
};

const listWorldCupMatches = async () => {
  const tournamentIds = await listWorldCupTournamentIds();
  const matches = await rest("matches?select=*&deleted_at=is.null&order=start_time.asc");

  return (matches ?? []).filter(
    (match) => match.championship === championship || tournamentIds.has(match.tournament_id),
  );
};

const updateMatchWindowAndStatus = async (match, now) => {
  const windowPayload = calculatePredictionWindow(match.start_time);
  const nextStatus = calculateMatchStatus(match, now);
  const needsUpdate =
    toIso(match.prediction_open_at) !== windowPayload.prediction_open_at ||
    toIso(match.prediction_close_at) !== windowPayload.prediction_close_at ||
    match.status !== nextStatus;

  if (!needsUpdate) return null;

  if (!dryRun) {
    await rest(`matches?id=eq.${match.id}`, {
      body: JSON.stringify({
        ...windowPayload,
        status: nextStatus,
      }),
      method: "PATCH",
    });
  }

  return {
    from: match.status,
    id: match.id,
    name: `${match.home_team} x ${match.away_team}`,
    to: nextStatus,
  };
};

const listPredictionsForMatch = (matchId) =>
  rest(`predictions?select=*&match_id=eq.${matchId}`);

const sameNumber = (left, right) => Number(left ?? 0) === Number(right ?? 0);

const scoreFinishedMatch = async (match) => {
  const predictions = await listPredictionsForMatch(match.id);
  const changes = [];

  for (const prediction of predictions ?? []) {
    const points = calculatePredictionPoints(match, prediction);
    if (prediction.points === points) continue;

    changes.push({
      from: prediction.points,
      id: prediction.id,
      points,
      userId: prediction.user_id,
    });

    if (!dryRun) {
      await rest(`predictions?id=eq.${prediction.id}`, {
        body: JSON.stringify({ points }),
        method: "PATCH",
      });
    }
  }

  return changes;
};

const refreshRankings = async () => {
  const [users, predictions, matches, rankings] = await Promise.all([
    rest("users?select=id,status,approval_status,blocked,deleted_at&deleted_at=is.null"),
    rest("predictions?select=*"),
    rest("matches?select=id,status,home_score,away_score&deleted_at=is.null"),
    rest("rankings?select=user_id,total_points,correct_results,exact_scores"),
  ]);
  const matchById = new Map((matches ?? []).map((match) => [match.id, match]));
  const rankingByUser = new Map((rankings ?? []).map((ranking) => [ranking.user_id, ranking]));
  const predictionsByUser = new Map();

  for (const prediction of predictions ?? []) {
    if (!predictionsByUser.has(prediction.user_id)) predictionsByUser.set(prediction.user_id, []);
    predictionsByUser.get(prediction.user_id).push(prediction);
  }

  const changes = [];
  for (const user of users ?? []) {
    const status = user.status ?? (user.blocked ? "suspended" : user.approval_status);
    if (status !== "approved" || user.blocked) continue;

    const userPredictions = predictionsByUser.get(user.id) ?? [];
    const totalPoints = userPredictions.reduce((sum, prediction) => sum + Number(prediction.points ?? 0), 0);
    const correctResults = userPredictions.filter((prediction) => Number(prediction.points ?? 0) > 0).length;
    const exactScores = userPredictions.filter((prediction) => {
      const match = matchById.get(prediction.match_id);
      return Boolean(
        match &&
          match.status === "encerrado" &&
          prediction.predicted_home_score === match.home_score &&
          prediction.predicted_away_score === match.away_score,
      );
    }).length;

    const current = rankingByUser.get(user.id);
    const nextRanking = {
      correct_results: correctResults,
      exact_scores: exactScores,
      total_points: totalPoints,
    };
    const needsUpdate =
      !current ||
      !sameNumber(current.correct_results, nextRanking.correct_results) ||
      !sameNumber(current.exact_scores, nextRanking.exact_scores) ||
      !sameNumber(current.total_points, nextRanking.total_points);

    if (!needsUpdate) continue;

    changes.push({
      from: current
        ? {
            correct_results: Number(current.correct_results ?? 0),
            exact_scores: Number(current.exact_scores ?? 0),
            total_points: Number(current.total_points ?? 0),
          }
        : null,
      to: nextRanking,
      userId: user.id,
    });

    if (!dryRun) {
      await rest("rankings?on_conflict=user_id", {
        body: JSON.stringify({
          ...nextRanking,
          updated_at: new Date().toISOString(),
          user_id: user.id,
        }),
        headers: {
          Prefer: "resolution=merge-duplicates,return=representation",
        },
        method: "POST",
      });
    }
  }

  return changes;
};

const run = async () => {
  const now = new Date(optionalEnv("MATCH_JOB_NOW", new Date().toISOString()));
  const matches = await listWorldCupMatches();
  const statusUpdates = [];
  const scoringUpdates = [];

  for (const match of matches) {
    const update = await updateMatchWindowAndStatus(match, now);
    if (update) statusUpdates.push(update);

    if (match.status === "encerrado") {
      const changes = await scoreFinishedMatch(match);
      if (changes.length) {
        scoringUpdates.push({
          matchId: match.id,
          name: `${match.home_team} x ${match.away_team}`,
          predictions: changes.length,
        });
      }
    }
  }

  const rankingUpdates = await refreshRankings();

  console.log(JSON.stringify({
    championship,
    dryRun,
    matchesChecked: matches.length,
    now: now.toISOString(),
    rankingUpdates,
    rankingsUpdated: rankingUpdates.length,
    scoringUpdates,
    statusUpdates,
  }, null, 2));
};

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
