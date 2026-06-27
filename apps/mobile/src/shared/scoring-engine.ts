export type ScoreInput = {
  homeScore: number;
  awayScore: number;
};

export type PredictionOutcome = "home" | "away" | "draw";

export type OfficialPredictionMarkets = ScoreInput & {
  firstScorer?: string | null;
  firstScorerId?: string | null;
  manOfMatch?: string | null;
  manOfMatchId?: string | null;
};

export type UserPredictionMarkets = ScoreInput & {
  winner?: PredictionOutcome | null;
  firstScorer?: string | null;
  firstScorerId?: string | null;
  bothTeamsScore?: boolean | null;
  manOfMatch?: string | null;
  manOfMatchId?: string | null;
};

export type ScoringOptions = {
  isGoldenMatch?: boolean;
  isUpset?: boolean;
};

export type ScoringStatus = "hit" | "miss" | "pending";
export type ExtraScoringStatus = ScoringStatus | "no_official_data" | "not_applicable";

export type PredictionPointsBreakdown = {
  main: {
    label: "Placar exato" | "Resultado correto" | "Resultado errado";
    points: number;
    maxPoints: 10;
    status: ScoringStatus;
  };
  extras: {
    firstScorer: {
      label: string;
      points: number;
      maxPoints: 5;
      status: ExtraScoringStatus;
    };
    bothTeamsScore: {
      label: string;
      points: number;
      maxPoints: 2;
      status: ScoringStatus;
    };
    manOfMatch: {
      label: string;
      points: number;
      maxPoints: 3;
      status: ExtraScoringStatus;
    };
  };
  total: number;
  version: "simple-v3";
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

export const calculatePredictionBreakdown = (
  official: OfficialPredictionMarkets,
  prediction: UserPredictionMarkets,
  _options: ScoringOptions = {},
): PredictionPointsBreakdown => {
  const exact = official.homeScore === prediction.homeScore && official.awayScore === prediction.awayScore;
  const winner = prediction.winner ?? predictionOutcome(prediction);
  const sameOutcome = predictionOutcome(official) === winner;
  const isNoGoalMatch = official.homeScore === 0 && official.awayScore === 0;

  const main = exact
    ? { label: "Placar exato" as const, maxPoints: 10 as const, points: 10, status: "hit" as const }
    : sameOutcome
      ? { label: "Resultado correto" as const, maxPoints: 10 as const, points: 5, status: "hit" as const }
      : { label: "Resultado errado" as const, maxPoints: 10 as const, points: 0, status: "miss" as const };

  const hasOfficialFirstScorer = Boolean(official.firstScorerId || normalizeMarketText(official.firstScorer));
  const firstScorerHit = Boolean(
    !isNoGoalMatch
    && (
      (
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
    )
  );
  const firstScorer = isNoGoalMatch
    ? { label: "Nao se aplica", maxPoints: 5 as const, points: 0, status: "not_applicable" as const }
    : !hasOfficialFirstScorer
      ? { label: "Sem dado oficial", maxPoints: 5 as const, points: 0, status: "no_official_data" as const }
      : {
          label: firstScorerHit ? "Primeiro jogador correto" : "Primeiro jogador errado",
          maxPoints: 5 as const,
          points: firstScorerHit ? 5 : 0,
          status: firstScorerHit ? "hit" as const : "miss" as const,
        };

  const bothTeamsScoreHit =
    prediction.bothTeamsScore !== null
    && prediction.bothTeamsScore !== undefined
    && prediction.bothTeamsScore === (official.homeScore > 0 && official.awayScore > 0);
  const bothTeamsScore = {
    label: bothTeamsScoreHit ? "Ambos marcam correto" : "Ambos marcam errado",
    maxPoints: 2 as const,
    points: bothTeamsScoreHit ? 2 : 0,
    status: bothTeamsScoreHit ? "hit" as const : "miss" as const,
  };

  const hasOfficialManOfMatch = Boolean(official.manOfMatchId || normalizeMarketText(official.manOfMatch));
  const manOfMatchHit = Boolean(
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
    )
  );
  const manOfMatch = !hasOfficialManOfMatch
    ? { label: "Sem dado oficial", maxPoints: 3 as const, points: 0, status: "no_official_data" as const }
    : {
        label: manOfMatchHit ? "Craque correto" : "Craque errado",
        maxPoints: 3 as const,
        points: manOfMatchHit ? 3 : 0,
        status: manOfMatchHit ? "hit" as const : "miss" as const,
      };

  const total = main.points + firstScorer.points + bothTeamsScore.points + manOfMatch.points;

  return {
    extras: {
      bothTeamsScore,
      firstScorer,
      manOfMatch,
    },
    main,
    total,
    version: "simple-v3",
  };
};

export const calculatePredictionPoints = (
  official: OfficialPredictionMarkets,
  prediction: UserPredictionMarkets,
  options: ScoringOptions = {},
) => calculatePredictionBreakdown(official, prediction, options).total;

export const isExactScore = (official: ScoreInput, prediction: ScoreInput) =>
  official.homeScore === prediction.homeScore && official.awayScore === prediction.awayScore;
