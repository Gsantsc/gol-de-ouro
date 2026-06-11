import type { MatchStatus } from "./types";

export const PREDICTION_OPEN_OFFSET_HOURS = 24;
export const PREDICTION_CLOSE_OFFSET_HOURS = 1;

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

const readDate = (value: string | null | undefined, fallback: Date) => {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
};

// PREDICTION WINDOW
export const calculatePredictionWindow = (startTime: string): PredictionWindow => {
  const startAt = readDate(startTime, new Date());

  return {
    closeAt: new Date(startAt.getTime() - PREDICTION_CLOSE_OFFSET_HOURS * HOUR_MS),
    openAt: new Date(startAt.getTime() - PREDICTION_OPEN_OFFSET_HOURS * HOUR_MS)
  };
};

export const resolvePredictionWindow = (match: MatchStatusInput): PredictionWindow => {
  const calculated = calculatePredictionWindow(match.start_time);

  return {
    closeAt: readDate(match.prediction_close_at, calculated.closeAt),
    openAt: readDate(match.prediction_open_at, calculated.openAt)
  };
};

// MATCH STATUS ENGINE
export const calculateMatchStatus = (match: MatchStatusInput, now = new Date()): MatchStatus => {
  if (match.status === "encerrado") return "encerrado";

  const { closeAt, openAt } = resolvePredictionWindow(match);

  if (now < openAt) return "fechado";
  if (now < closeAt) return "aberto";
  return "ao_vivo";
};

export const predictionWindowPayload = (startTime: string) => {
  const { closeAt, openAt } = calculatePredictionWindow(startTime);

  return {
    prediction_close_at: closeAt.toISOString(),
    prediction_open_at: openAt.toISOString()
  };
};
