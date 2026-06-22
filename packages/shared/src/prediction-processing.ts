import type { Match, Prediction } from "./types";

export type MatchProcessingInput = Pick<Match, "status" | "start_time" | "stats">;

const readStats = (match: MatchProcessingInput): Record<string, unknown> =>
  match.stats && typeof match.stats === "object" ? match.stats as Record<string, unknown> : {};

export const isMatchKickoffInPast = (match: MatchProcessingInput, now = new Date()) => {
  const start = new Date(match.start_time);
  return !Number.isNaN(start.getTime()) && now.getTime() > start.getTime();
};

export const isMatchLiveStatus = (match: MatchProcessingInput) => match.status === "ao_vivo";

export const isMatchFinishedStatus = (match: MatchProcessingInput) => match.status === "encerrado";

export const isMatchFinishedForScoring = (match: MatchProcessingInput) => {
  if (isMatchFinishedStatus(match)) return true;

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

export const isMatchProcessableForRecalculate = (
  match: MatchProcessingInput,
  matchPredictions: Array<{ locked?: boolean | null; points?: number | null }>,
  now = new Date(),
) => {
  if (isMatchFinishedForScoring(match)) return true;
  if (isMatchLiveStatus(match)) return false;
  if (!isMatchKickoffInPast(match, now)) return false;

  return matchPredictions.some(
    (prediction) => prediction.locked === true || Number(prediction.points ?? 0) > 0,
  );
};

export const isMatchProcessedForPrediction = (
  prediction: Prediction,
  match?: MatchProcessingInput | null,
  now = new Date(),
) => {
  if (!match) return false;
  if (isMatchFinishedForScoring(match)) return true;
  if (isMatchLiveStatus(match)) return false;

  if (!isMatchKickoffInPast(match, now)) return false;

  if (prediction.locked === true) return true;
  if ((prediction.points ?? 0) > 0) return true;

  return false;
};
