import type { SupabaseClient } from "@supabase/supabase-js";
import {
  calculatePredictionPoints,
  isMatchFinishedForScoring,
  isMatchLiveStatus,
  isMatchProcessableForRecalculate,
  predictionOutcome,
  type MatchStatus,
  type PredictionWinner,
} from "@gol-de-ouro/shared";

type MatchRow = {
  id: string;
  away_score: number;
  away_team: string;
  championship?: string | null;
  first_goal_no_goals?: boolean | null;
  first_goal_scorer?: string | null;
  first_goal_scorer_id?: string | null;
  home_score: number;
  home_team: string;
  man_of_match?: string | null;
  man_of_match_id?: string | null;
  red_card_happened?: boolean | null;
  red_cards_away?: number | null;
  red_cards_home?: number | null;
  start_time: string;
  stats?: Record<string, unknown> | null;
  status: MatchStatus;
};

type PredictionRow = {
  id: string;
  locked?: boolean;
  match_id: string;
  points: number;
  predicted_away_score: number;
  predicted_both_teams_score?: boolean | null;
  predicted_first_goal_no_goals?: boolean | null;
  predicted_first_scorer?: string | null;
  predicted_first_scorer_id?: string | null;
  predicted_home_score: number;
  predicted_man_of_match?: string | null;
  predicted_man_of_match_id?: string | null;
  predicted_red_card?: boolean | null;
  predicted_winner?: PredictionWinner | null;
  user_id: string;
};

type UserRow = {
  approval_status?: string | null;
  blocked?: boolean | null;
  deleted_at?: string | null;
  id: string;
  status?: string | null;
};

export type RecalculatePredictionsOptions = {
  adminId?: string;
  championship?: string;
  dryRun?: boolean;
  supabase: SupabaseClient;
};

export type RecalculatePredictionsSummary = {
  championship: string;
  competitionRankingsUpdated: number;
  dryRun: boolean;
  finishedMatches: number;
  message: string;
  predictionsFound: number;
  predictionsUpdated: number;
  rankingsUpdated: number;
  skippedMatches: number;
  skippedReasons: Record<string, number>;
  status: "success" | "failed";
  totalMatches: number;
  usersUpdated: number;
};

const dedupeByKey = <T,>(rows: T[], getKey: (row: T) => string) => {
  const map = new Map<string, T>();
  for (const row of rows) {
    map.set(getKey(row), row);
  }
  return [...map.values()];
};

const predictionPointsFor = (match: MatchRow, prediction: PredictionRow) => {
  const homeScore = Number(match.home_score ?? 0);
  const awayScore = Number(match.away_score ?? 0);

  return calculatePredictionPoints(
    {
      awayScore,
      firstScorer: match.first_goal_scorer,
      firstScorerId: match.first_goal_scorer_id,
      homeScore,
      manOfMatch: match.man_of_match,
      manOfMatchId: match.man_of_match_id,
    },
    {
      awayScore: Number(prediction.predicted_away_score ?? 0),
      bothTeamsScore: prediction.predicted_both_teams_score,
      firstScorer: prediction.predicted_first_scorer,
      firstScorerId: prediction.predicted_first_scorer_id,
      homeScore: Number(prediction.predicted_home_score ?? 0),
      manOfMatch: prediction.predicted_man_of_match,
      manOfMatchId: prediction.predicted_man_of_match_id,
      winner: prediction.predicted_winner,
    },
  );
};

const skipReasonForMatch = (match: MatchRow, matchPredictions: PredictionRow[]) => {
  if (isMatchProcessableForRecalculate(match, matchPredictions)) return null;
  if (isMatchLiveStatus(match)) return "live_match";
  if (isMatchFinishedForScoring(match)) return null;
  return "not_finished";
};

type ProviderRunPayload = {
  inserted_count: number;
  message: string;
  provider_name: string;
  status: "success" | "failed";
  updated_count: number;
};

type AdminLogPayload = {
  action: string;
  admin_id: string;
  entity: string;
};

const writeProviderRun = async (
  supabase: SupabaseClient,
  summary: RecalculatePredictionsSummary,
) => {
  const minimalPayload: ProviderRunPayload = {
    inserted_count: 0,
    message: summary.message,
    provider_name: "recalculate-predictions",
    status: summary.status,
    updated_count: summary.predictionsUpdated,
  };

  const { error } = await supabase.from("match_provider_runs").insert(minimalPayload);
  if (!error) return;

  console.warn("[recalculate-predictions] failed to write provider run", error.message);
};

const writeAdminLog = async (
  supabase: SupabaseClient,
  adminId: string | undefined,
  message: string,
) => {
  if (!adminId) return;

  const { error } = await supabase.from("admin_logs").insert({
    action: message,
    admin_id: adminId,
    entity: "predictions",
  });

  if (error) {
    console.warn("[recalculate-predictions] failed to write admin log", error.message);
  }
};

export const runRecalculatePredictions = async ({
  adminId,
  championship = "world_cup_2026",
  dryRun = false,
  supabase,
}: RecalculatePredictionsOptions): Promise<RecalculatePredictionsSummary> => {
  const skippedReasons: Record<string, number> = {};
  let predictionsFound = 0;
let predictionsUpdated = 0;
let rankingsUpdated = 0;
let competitionRankingsUpdated = 0;

  try {
    const { data: matchesData, error: matchesError } = await supabase
      .from("matches")
      .select("*")
      .eq("championship", championship)
      .is("deleted_at", null)
      .order("start_time", { ascending: true });

    if (matchesError) throw matchesError;

    const allMatches = (matchesData ?? []) as MatchRow[];
    const { data: allPredictionsData, error: allPredictionsError } = await supabase
      .from("predictions")
      .select("*");
    if (allPredictionsError) throw allPredictionsError;

    const allPredictions = (allPredictionsData ?? []) as PredictionRow[];
    const predictionsByMatch = new Map<string, PredictionRow[]>();
    const predictionsByUser = new Map<string, PredictionRow[]>();
    for (const prediction of allPredictions) {
      if (!predictionsByMatch.has(prediction.match_id)) predictionsByMatch.set(prediction.match_id, []);
      predictionsByMatch.get(prediction.match_id)?.push(prediction);
      if (!predictionsByUser.has(prediction.user_id)) predictionsByUser.set(prediction.user_id, []);
      predictionsByUser.get(prediction.user_id)?.push(prediction);
    }

    const scorableMatches = allMatches.filter((match) =>
      isMatchProcessableForRecalculate(match, predictionsByMatch.get(match.id) ?? []),
    );
    const skippedMatches = allMatches.length - scorableMatches.length;

    for (const match of allMatches) {
      const reason = skipReasonForMatch(match, predictionsByMatch.get(match.id) ?? []);
      if (reason) {
        skippedReasons[reason] = (skippedReasons[reason] ?? 0) + 1;
      }
    }

    const scorableMatchIdSet = new Set(scorableMatches.map((match) => match.id));
    const scorablePredictions = allPredictions.filter((prediction) => scorableMatchIdSet.has(prediction.match_id));
    predictionsFound = scorablePredictions.length;

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
          const { error } = await supabase
            .from("predictions")
            .update({ locked: true, points })
            .eq("id", prediction.id);
          if (error) throw error;
        }
      }
    }

const [
  { data: usersData, error: usersError },
  { data: rankingsData, error: rankingsError },
  { data: competitionRankingsData, error: competitionRankingsError },
] = await Promise.all([
  supabase.from("users").select("id,status,approval_status,blocked,deleted_at").is("deleted_at", null),
  supabase.from("rankings").select("user_id,total_points,correct_results,exact_scores"),
  supabase
    .from("competition_rankings")
    .select("championship,user_id,total_points,correct_results,exact_scores")
    .eq("championship", championship),
]);

if (usersError) throw usersError;
if (rankingsError) throw rankingsError;
if (competitionRankingsError) throw competitionRankingsError;

const users = (usersData ?? []) as UserRow[];
const rankings = rankingsData ?? [];
const competitionRankings = competitionRankingsData ?? [];
const rankingByUser = new Map(rankings.map((ranking) => [ranking.user_id, ranking]));
const competitionRankingByUser = new Map(competitionRankings.map((ranking) => [ranking.user_id, ranking]));
const matchById = new Map(allMatches.map((match) => [match.id, match]));

const changed: Array<{
  correct_results: number;
  exact_scores: number;
  total_points: number;
  updated_at: string;
  user_id: string;
}> = [];
const competitionChanged: Array<{
  championship: string;
  correct_results: number;
  exact_scores: number;
  total_points: number;
  updated_at: string;
  user_id: string;
}> = [];

for (const user of users) {
  const status = user.status ?? (user.blocked ? "suspended" : user.approval_status);
  if (status !== "approved" || user.blocked) continue;

  const userPredictions = predictionsByUser.get(user.id) ?? [];
  const competitionUserPredictions = userPredictions.filter((prediction) => matchById.has(prediction.match_id));

  const totalPoints = userPredictions.reduce((sum, prediction) => sum + Number(prediction.points ?? 0), 0);
  const competitionTotalPoints = competitionUserPredictions.reduce((sum, prediction) => sum + Number(prediction.points ?? 0), 0);

  const correctResults = userPredictions.filter((prediction) => {
    const match = matchById.get(prediction.match_id);
    if (!match || !isMatchFinishedForScoring(match)) return false;

    const officialOutcome = predictionOutcome({
      homeScore: Number(match.home_score ?? 0),
      awayScore: Number(match.away_score ?? 0),
    });

    const predictedWinner =
      prediction.predicted_winner ??
      predictionOutcome({
        homeScore: Number(prediction.predicted_home_score ?? 0),
        awayScore: Number(prediction.predicted_away_score ?? 0),
      });

    return officialOutcome === predictedWinner;
  }).length;

  const exactScores = userPredictions.filter((prediction) => {
    const match = matchById.get(prediction.match_id);
    return Boolean(
      match &&
      match.status === "encerrado" &&
      Number(prediction.predicted_home_score) === Number(match.home_score) &&
      Number(prediction.predicted_away_score) === Number(match.away_score),
    );
  }).length;

  const competitionCorrectResults = competitionUserPredictions.filter((prediction) => {
    const match = matchById.get(prediction.match_id);
    if (!match || !isMatchFinishedForScoring(match)) return false;

    const officialOutcome = predictionOutcome({
      homeScore: Number(match.home_score ?? 0),
      awayScore: Number(match.away_score ?? 0),
    });

    const predictedWinner =
      prediction.predicted_winner ??
      predictionOutcome({
        homeScore: Number(prediction.predicted_home_score ?? 0),
        awayScore: Number(prediction.predicted_away_score ?? 0),
      });

    return officialOutcome === predictedWinner;
  }).length;

  const competitionExactScores = competitionUserPredictions.filter((prediction) => {
    const match = matchById.get(prediction.match_id);
    return Boolean(
      match &&
      match.status === "encerrado" &&
      Number(prediction.predicted_home_score) === Number(match.home_score) &&
      Number(prediction.predicted_away_score) === Number(match.away_score),
    );
  }).length;

  const current = rankingByUser.get(user.id);
  const competitionCurrent = competitionRankingByUser.get(user.id);

  if (
    !competitionCurrent ||
    Number(competitionCurrent.total_points ?? 0) !== competitionTotalPoints ||
    Number(competitionCurrent.correct_results ?? 0) !== competitionCorrectResults ||
    Number(competitionCurrent.exact_scores ?? 0) !== competitionExactScores
  ) {
    competitionChanged.push({
      championship,
      correct_results: competitionCorrectResults,
      exact_scores: competitionExactScores,
      total_points: competitionTotalPoints,
      updated_at: new Date().toISOString(),
      user_id: user.id,
    });
  }

  if (
    current &&
    Number(current.total_points ?? 0) === totalPoints &&
    Number(current.correct_results ?? 0) === correctResults &&
    Number(current.exact_scores ?? 0) === exactScores
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

rankingsUpdated = changed.length;
competitionRankingsUpdated = competitionChanged.length;

if (changed.length && !dryRun) {
  const rankingPayload = dedupeByKey(changed, (row) => row.user_id);
  const { error } = await supabase
    .from("rankings")
    .upsert(rankingPayload, { onConflict: "user_id" });
  if (error) throw error;
}

if (competitionChanged.length && !dryRun) {
  const competitionRankingPayload = dedupeByKey(
    competitionChanged,
    (row) => `${row.championship}:${row.user_id}`,
  );

  const { error } = await supabase
    .from("competition_rankings")
    .upsert(competitionRankingPayload, { onConflict: "championship,user_id" });

  if (error) throw error;
}

    const message = `Pontuacao recalculada: ${scorableMatches.length} jogos encerrados; ${predictionsUpdated} palpites recalculados; ${rankingsUpdated} rankings globais atualizados; ${competitionRankingsUpdated} rankings de competicao atualizados.`;
    const summary: RecalculatePredictionsSummary = {
      championship,
      competitionRankingsUpdated,
      dryRun,
      finishedMatches: scorableMatches.length,
      message,
      predictionsFound,
      predictionsUpdated,
      rankingsUpdated,
      skippedMatches,
      skippedReasons,
      status: "success",
      totalMatches: allMatches.length,
      usersUpdated: rankingsUpdated,
    };

    if (!dryRun) {
      await Promise.all([
        writeProviderRun(supabase, summary),
        writeAdminLog(supabase, adminId, message),
      ]);
    }

    console.log(`[recalculate-predictions] ${message}`);
    return summary;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao recalcular pontuacao.";
    console.error("[recalculate-predictions]", message);

    return {
  championship,
  competitionRankingsUpdated,
  dryRun,
  finishedMatches: 0,
      message,
      predictionsFound,
      predictionsUpdated,
      rankingsUpdated,
      skippedMatches: 0,
      skippedReasons,
      status: "failed",
      totalMatches: 0,
      usersUpdated: 0,
    };
  }
};
