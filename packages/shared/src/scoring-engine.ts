export type ScoreInput = {
  homeScore: number;
  awayScore: number;
};

export type PredictionOutcome = "home" | "away" | "draw";

export type OfficialPredictionMarkets = ScoreInput & {
  firstScorer?: string | null;
  firstScorerId?: string | null;
  firstGoalNoGoals?: boolean | null;
  manOfMatch?: string | null;
  manOfMatchId?: string | null;
  redCard?: boolean | null;
};

export type UserPredictionMarkets = ScoreInput & {
  winner?: PredictionOutcome | null;
  firstScorer?: string | null;
  firstScorerId?: string | null;
  firstGoalNoGoals?: boolean | null;
  bothTeamsScore?: boolean | null;
  manOfMatch?: string | null;
  manOfMatchId?: string | null;
  redCard?: boolean | null;
};

export type ScoringOptions = {
  isGoldenMatch?: boolean;
  isUpset?: boolean;
};

export const predictionOutcome = ({ awayScore, homeScore }: ScoreInput): PredictionOutcome => {
  if (homeScore > awayScore) return "home";
  if (awayScore > homeScore) return "away";
  return "draw";
};

const normalizeMarketText = (value?: string | null) => {
  const normalized = value?.trim().toLowerCase();
  return normalized || null;
};

// SCORING ENGINE
export const calculatePredictionPoints = (
  official: OfficialPredictionMarkets,
  prediction: UserPredictionMarkets,
  _options: ScoringOptions = {},
) => {
  const exact = official.homeScore === prediction.homeScore && official.awayScore === prediction.awayScore;
  const winner = prediction.winner ?? predictionOutcome(prediction);
  const sameOutcome = predictionOutcome(official) === winner;
  const sameGoalDifference = official.homeScore - official.awayScore === prediction.homeScore - prediction.awayScore;
 const isNoGoalMatch = official.homeScore === 0 && official.awayScore === 0;

const firstScorer = isNoGoalMatch
  ? prediction.firstGoalNoGoals === true
  : (
      (official.firstGoalNoGoals === true && prediction.firstGoalNoGoals === true)
      || (
        official.firstScorerId !== null
        && official.firstScorerId !== undefined
        && prediction.firstScorerId !== null
        && prediction.firstScorerId !== undefined
        && official.firstScorerId === prediction.firstScorerId
      )
      || (
        official.firstScorerId == null
        && prediction.firstScorerId == null
        && normalizeMarketText(official.firstScorer) !== null
        && normalizeMarketText(official.firstScorer) === normalizeMarketText(prediction.firstScorer)
      )
    );
  const bothTeamsScore =
    prediction.bothTeamsScore !== null
    && prediction.bothTeamsScore !== undefined
    && prediction.bothTeamsScore === (official.homeScore > 0 && official.awayScore > 0);
  const manOfMatch =
    (
      official.manOfMatchId !== null
      && official.manOfMatchId !== undefined
      && prediction.manOfMatchId !== null
      && prediction.manOfMatchId !== undefined
      && official.manOfMatchId === prediction.manOfMatchId
    )
    || (
      official.manOfMatchId == null
      && prediction.manOfMatchId == null
      && normalizeMarketText(official.manOfMatch) !== null
      && normalizeMarketText(official.manOfMatch) === normalizeMarketText(prediction.manOfMatch)
    );
  const redCard =
    prediction.redCard !== null
    && prediction.redCard !== undefined
    && official.redCard !== null
    && official.redCard !== undefined
    && prediction.redCard === official.redCard;

let points = 0;

if (exact) {
  points += 10;
} else {
  if (sameOutcome) points += 5;
  if (sameGoalDifference) points += 3;
}

if (firstScorer) points += 8;
if (bothTeamsScore) points += 2;
if (manOfMatch) points += 6;
if (redCard) points += 2;

return points;
};

export const isExactScore = (official: ScoreInput, prediction: ScoreInput) =>
  official.homeScore === prediction.homeScore && official.awayScore === prediction.awayScore;
