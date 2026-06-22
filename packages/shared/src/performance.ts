import { isMatchProcessedForPrediction } from "./prediction-processing";
import type { Match, Prediction, Ranking } from "./types";

export type UserPerformance = {
  bestStreak: number;
  correctResults: number;
  currentStreak: number;
  exactScores: number;
  finishedPredictions: number;
  hitRate: number;
  totalPoints: number;
  totalPredictions: number;
};

const predictionTime = (prediction: Prediction, matchById: Map<string, Match>) => {
  const match = matchById.get(prediction.match_id);
  return new Date(match?.start_time ?? prediction.submitted_at).getTime();
};

export const deriveUserPerformance = ({
  matches,
  predictions,
  ranking
}: {
  matches: Match[];
  predictions: Prediction[];
  ranking?: Ranking | null;
}): UserPerformance => {
  const matchById = new Map(matches.map((match) => [match.id, match]));
  const finished = predictions
    .filter((prediction) => {
      const match = matchById.get(prediction.match_id);
      return match ? isMatchProcessedForPrediction(prediction, match) : false;
    })
    .sort((left, right) => predictionTime(left, matchById) - predictionTime(right, matchById));

  const derivedCorrect = finished.filter((prediction) => prediction.points > 0).length;
  const derivedExact = finished.filter((prediction) => {
    const match = matchById.get(prediction.match_id);
    return Boolean(
      match
      && prediction.predicted_home_score === match.home_score
      && prediction.predicted_away_score === match.away_score
    );
  }).length;
  const correctResults = ranking?.correct_results ?? derivedCorrect;
  const exactScores = ranking?.exact_scores ?? derivedExact;
  const totalPoints = ranking?.total_points
    ?? finished.reduce((sum, prediction) => sum + Number(prediction.points ?? 0), 0);

  let runningStreak = 0;
  let bestStreak = 0;
  for (const prediction of finished) {
    if (prediction.points > 0) {
      runningStreak += 1;
      bestStreak = Math.max(bestStreak, runningStreak);
    } else {
      runningStreak = 0;
    }
  }

  let currentStreak = 0;
  for (let index = finished.length - 1; index >= 0; index -= 1) {
    if (finished[index].points <= 0) break;
    currentStreak += 1;
  }

  return {
    bestStreak,
    correctResults,
    currentStreak,
    exactScores,
    finishedPredictions: finished.length,
    hitRate: finished.length ? Math.round((correctResults / finished.length) * 100) : 0,
    totalPoints,
    totalPredictions: predictions.length
  };
};

export const compareRankings = (left: Ranking, right: Ranking) => {
  if (left.total_points !== right.total_points) return right.total_points - left.total_points;
  if (left.exact_scores !== right.exact_scores) return right.exact_scores - left.exact_scores;

  const updatedDifference = new Date(left.updated_at).getTime() - new Date(right.updated_at).getTime();
  if (updatedDifference !== 0) return updatedDifference;
  return left.user_id.localeCompare(right.user_id);
};

export const sortRankings = (ranking: Ranking[]) => [...ranking].sort(compareRankings);

