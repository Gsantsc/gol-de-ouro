import type { MatchStatus } from "./types";

export const PREDICTION_OPEN_OFFSET_HOURS = 24;
export const DEFAULT_PREDICTION_LOCK_MINUTES = 60;
export const PREDICTION_CLOSE_OFFSET_HOURS = DEFAULT_PREDICTION_LOCK_MINUTES / 60;
export const ALLOWED_PREDICTION_LOCK_MINUTES = [60, 90, 120, 180] as const;

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

// MATCH STATUS ENGINE
export const calculateMatchStatus = (
  match: MatchStatusInput,
  now = new Date(),
  predictionLockMinutes?: number | null,
): MatchStatus => {
  if (match.status === "encerrado") return "encerrado";

  const { closeAt, openAt } = resolvePredictionWindow(match, predictionLockMinutes);
  const startAt = readDate(match.start_time, closeAt);

  if (now < openAt) return "fechado";
  if (now < closeAt) return "aberto";
  if (now < startAt) return "fechado";
  return "ao_vivo";
};

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
