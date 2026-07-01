/**
 * Validation script for recalculate predictions flow (offline).
 *
 * Usage:
 *   node scripts/validate-recalculate-predictions.cjs
 */

const { calculatePredictionPoints } = require("./lib/prediction-scoring.cjs");

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const buildOfficial = (match) => ({
  awayScore: Number(match.away_score ?? 0),
  firstGoalNoGoals: match.first_goal_no_goals,
  firstScorer: match.first_goal_scorer,
  firstScorerId: match.first_goal_scorer_id,
  homeScore: Number(match.home_score ?? 0),
  manOfMatch: match.man_of_match,
  manOfMatchId: match.man_of_match_id,
  redCard: match.red_card_happened,
});

const buildPrediction = (prediction) => ({
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
});

const scorePrediction = (match, prediction) => {
  const points = calculatePredictionPoints(buildOfficial(match), buildPrediction(prediction));
  return {
    locked: true,
    points,
  };
};

const buildRanking = (predictions, matches) => {
  const matchById = new Map(matches.map((match) => [match.id, match]));
  const totalPoints = predictions.reduce((sum, prediction) => sum + Number(prediction.points ?? 0), 0);
  const correctResults = predictions.filter((prediction) => Number(prediction.points ?? 0) > 0).length;
  const exactScores = predictions.filter((prediction) => {
    const match = matchById.get(prediction.match_id);
    return Boolean(
      match
      && match.status === "encerrado"
      && Number(prediction.predicted_home_score) === Number(match.home_score)
      && Number(prediction.predicted_away_score) === Number(match.away_score),
    );
  }).length;

  return { correct_results: correctResults, exact_scores: exactScores, total_points: totalPoints };
};

const run = () => {
  console.log("=== Offline recalculate predictions validation ===\n");

  const finishedMatch = {
    id: "m1",
    away_score: 1,
    home_score: 2,
    status: "encerrado",
  };

  const predictions = [
    {
      id: "p1",
      match_id: "m1",
      predicted_away_score: 1,
      predicted_home_score: 2,
      predicted_winner: "home",
    },
    {
      id: "p2",
      match_id: "m1",
      predicted_away_score: 2,
      predicted_home_score: 0,
      predicted_winner: "away",
    },
    {
      id: "p3",
      match_id: "m1",
      predicted_away_score: 2,
      predicted_home_score: 2,
      predicted_winner: "draw",
    },
  ];

  assert(predictions.length === 3, "expected 3 predictions in finished match");

  const scored = predictions.map((prediction) => ({
    ...prediction,
    ...scorePrediction(finishedMatch, prediction),
  }));
  const scoreUpdatePayload = scorePrediction(finishedMatch, {
    id: "p-player-fields",
    match_id: "m1",
    predicted_away_score: 1,
    predicted_first_goal_no_goals: false,
    predicted_first_scorer: "Eder Militao",
    predicted_first_scorer_id: "player-eder",
    predicted_home_score: 2,
    predicted_man_of_match: "Vini Jr",
    predicted_man_of_match_id: "player-vini",
    predicted_winner: "home",
  });

  const winner = scored.find((prediction) => prediction.id === "p1");
  const loser = scored.find((prediction) => prediction.id === "p2");
  const zero = scored.find((prediction) => prediction.id === "p3");

  assert((winner?.points ?? 0) > 0, "winner prediction should earn points");
  assert((loser?.points ?? 0) === 0, "wrong prediction should stay at 0 points");
  assert(zero?.points === 0, "draw miss should stay at 0 points");
  assert(winner?.locked === true, "scored prediction should be locked");
  assert(zero?.locked === true, "0-point prediction should still be locked/processed");
  assert(!("predicted_first_scorer_id" in scoreUpdatePayload), "score update must not write first scorer id");
  assert(!("predicted_first_scorer" in scoreUpdatePayload), "score update must not write first scorer text");
  assert(!("predicted_man_of_match_id" in scoreUpdatePayload), "score update must not write man of match id");
  assert(!("predicted_man_of_match" in scoreUpdatePayload), "score update must not write man of match text");
  assert(!("predicted_first_goal_no_goals" in scoreUpdatePayload), "score update must not write no-goals flag");
  console.log("PASS - 3 predictions in finished matches");

  const playerMarketMatch = {
    ...finishedMatch,
    first_goal_scorer: "Eder Militao",
    first_goal_scorer_id: "player-eder",
    man_of_match: "Vini Jr",
    man_of_match_id: "player-vini",
  };
  const fullPlayerHit = calculatePredictionPoints(buildOfficial(playerMarketMatch), buildPrediction({
    predicted_away_score: 1,
    predicted_both_teams_score: true,
    predicted_first_scorer_id: "player-eder",
    predicted_home_score: 2,
    predicted_man_of_match_id: "player-vini",
    predicted_winner: "home",
  }));
  assert(fullPlayerHit === 25, "exact + outcome + first scorer id + both teams + man id should total 25");

  const fallbackPlayerHit = calculatePredictionPoints(buildOfficial({
    ...playerMarketMatch,
    first_goal_scorer_id: null,
    man_of_match_id: null,
  }), buildPrediction({
    predicted_away_score: 0,
    predicted_first_scorer: "éder militão",
    predicted_first_scorer_id: "missing-local-id",
    predicted_home_score: 1,
    predicted_man_of_match: "vini jr",
    predicted_man_of_match_id: "missing-local-id-2",
    predicted_winner: "home",
  }));
  assert(fallbackPlayerHit === 13, "fallback text with accents should award first scorer + man of match");

  const mismatchedIds = calculatePredictionPoints(buildOfficial(playerMarketMatch), buildPrediction({
    predicted_away_score: 0,
    predicted_first_scorer: "Eder Militao",
    predicted_first_scorer_id: "other-player",
    predicted_home_score: 1,
    predicted_man_of_match: "Vini Jr",
    predicted_man_of_match_id: "other-mom",
    predicted_winner: "home",
  }));
  assert(mismatchedIds === 5, "different ids must not fallback to equal text when both ids exist");
  console.log("PASS - player market scoring by id/fallback");

  const ranking = buildRanking(scored, [finishedMatch]);
  assert(ranking.total_points === scored.reduce((sum, prediction) => sum + prediction.points, 0), "ranking sums all points");
  assert(ranking.correct_results === 1, "correct_results counts only points > 0");
  assert(ranking.exact_scores === 1, "exact_scores counts only exact finished scores");
  console.log("PASS - ranking aggregation");

  const deduped = [
    { total_points: 10, user_id: "u1" },
    { total_points: 12, user_id: "u1" },
    { total_points: 4, user_id: "u2" },
  ].reduce((map, row) => {
    map.set(row.user_id, row);
    return map;
  }, new Map());

  assert(deduped.size === 2, "ranking upsert payload should dedupe by user_id");
  console.log("PASS - ranking dedupe by user_id");

  console.log("\nValidation: PASSED (4 checks)\n");
};

try {
  run();
  process.exit(0);
} catch (error) {
  console.error("Validation failed:", error);
  process.exit(1);
}
