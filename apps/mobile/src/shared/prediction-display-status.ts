import type { Match, Prediction } from "./types";
import { isMatchLiveStatus, isMatchProcessedForPrediction } from "./prediction-processing";

export type PredictionDisplayStatus =
  | "waiting"
  | "live"
  | "scored_win"
  | "scored_zero"
  | "invalid_match";

export type PredictionCategory = "scored" | "waiting" | "live" | "unavailable";

export type PredictionStatusTone = "default" | "green" | "gold" | "red" | "blue";

export const getPredictionDisplayStatus = (
  prediction: Prediction,
  match?: Match | null
): PredictionDisplayStatus => {
  if (!match) {
    return "invalid_match";
  }

  if (isMatchProcessedForPrediction(prediction, match)) {
    return (prediction.points ?? 0) > 0 ? "scored_win" : "scored_zero";
  }

  if (isMatchLiveStatus(match)) {
    return "live";
  }

  return "waiting";
};

export const getPredictionStatusLabel = (status: PredictionDisplayStatus): string => {
  switch (status) {
    case "waiting":
      return "Aguardando";
    case "live":
      return "Ao vivo";
    case "scored_win":
      return "Pontuou";
    case "scored_zero":
      return "0 pts";
    case "invalid_match":
      return "Partida indisponivel";
  }
};

export const getPredictionStatusTone = (status: PredictionDisplayStatus): PredictionStatusTone => {
  switch (status) {
    case "waiting":
      return "gold";
    case "live":
      return "blue";
    case "scored_win":
      return "green";
    case "scored_zero":
      return "red";
    case "invalid_match":
      return "default";
  }
};

export const getPredictionCategory = (
  prediction: Prediction,
  match?: Match | null
): PredictionCategory => {
  if (!match) return "unavailable";
  if (isMatchProcessedForPrediction(prediction, match)) return "scored";
  if (isMatchLiveStatus(match)) return "live";
  return "waiting";
};
