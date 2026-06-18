import type { MatchStatus } from "./types";

export const PREDICTION_OPEN_OFFSET_HOURS = 24;
export const DEFAULT_PREDICTION_LOCK_MINUTES = 60;
export const PREDICTION_CLOSE_OFFSET_HOURS = DEFAULT_PREDICTION_LOCK_MINUTES / 60;
export const ALLOWED_PREDICTION_LOCK_MINUTES = [60, 90, 120, 180] as const;
export const ASSUMED_MATCH_LIVE_WINDOW_MINUTES = 180;

export type MatchStatusInput = {
  prediction_close_at?: string | null;
  prediction_open_at?: string | null;
  start_time: string;
  status?: MatchStatus | null;
};

export type PredictionWindow = {
  closeAt: Date;
  openAt: Date;
};

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

const readDate = (value: string | null | undefined, fallback: Date) => {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
};

const readOptionalDate = (value: string | null | undefined) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const normalizePredictionLockMinutes = (value?: number | null) =>
  ALLOWED_PREDICTION_LOCK_MINUTES.includes(value as (typeof ALLOWED_PREDICTION_LOCK_MINUTES)[number])
    ? value as (typeof ALLOWED_PREDICTION_LOCK_MINUTES)[number]
    : DEFAULT_PREDICTION_LOCK_MINUTES;

// PREDICTION WINDOW
export const calculatePredictionWindow = (
  startTime: string,
  predictionLockMinutes = DEFAULT_PREDICTION_LOCK_MINUTES,
): PredictionWindow => {
  const startAt = readDate(startTime, new Date());
  const lockMinutes = normalizePredictionLockMinutes(predictionLockMinutes);

  return {
    closeAt: new Date(startAt.getTime() - lockMinutes * MINUTE_MS),
    openAt: new Date(startAt.getTime() - PREDICTION_OPEN_OFFSET_HOURS * HOUR_MS)
  };
};

export const resolvePredictionWindow = (
  match: MatchStatusInput,
  predictionLockMinutes?: number | null,
): PredictionWindow => {
  const calculated = calculatePredictionWindow(match.start_time, predictionLockMinutes ?? DEFAULT_PREDICTION_LOCK_MINUTES);

  return {
    closeAt: predictionLockMinutes == null
      ? readDate(match.prediction_close_at, calculated.closeAt)
      : calculated.closeAt,
    openAt: readDate(match.prediction_open_at, calculated.openAt)
  };
};

export const isMatchFinished = (match: MatchStatusInput) => match.status === "encerrado";

export const isMatchLive = (match: MatchStatusInput, now = new Date()) => {
  if (isMatchFinished(match) || match.status !== "ao_vivo") return false;

  const startAt = readOptionalDate(match.start_time);
  if (!startAt) return false;

  const liveWindowEndsAt = new Date(startAt.getTime() + ASSUMED_MATCH_LIVE_WINDOW_MINUTES * MINUTE_MS);
  return now >= startAt && now <= liveWindowEndsAt;
};

export const isMatchOpenForPrediction = (
  match: MatchStatusInput,
  now = new Date(),
  predictionLockMinutes?: number | null,
): boolean => {
  if (isMatchFinished(match) || isMatchLive(match, now)) return false;

  const { closeAt, openAt } = resolvePredictionWindow(match, predictionLockMinutes);
  const startAt = readDate(match.start_time, closeAt);

  return now >= openAt && now < closeAt && now < startAt;
};

export const getMatchComputedStatus = (
  match: MatchStatusInput,
  now = new Date(),
  predictionLockMinutes?: number | null,
): MatchStatus => {
  if (isMatchFinished(match)) return "encerrado";
  if (isMatchLive(match, now)) return "ao_vivo";
  if (isMatchOpenForPrediction(match, now, predictionLockMinutes)) return "aberto";
  return "fechado";
};

// MATCH STATUS ENGINE
export const calculateMatchStatus = getMatchComputedStatus;

export const predictionWindowPayload = (
  startTime: string,
  predictionLockMinutes = DEFAULT_PREDICTION_LOCK_MINUTES,
) => {
  const { closeAt, openAt } = calculatePredictionWindow(startTime, predictionLockMinutes);

  return {
    prediction_close_at: closeAt.toISOString(),
    prediction_open_at: openAt.toISOString()
  };
};
