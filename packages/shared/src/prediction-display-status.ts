import type { Match, Prediction } from "./types";

export type PredictionDisplayStatus =
  | "waiting"
  | "live"
  | "scored_win"
  | "scored_partial"
  | "scored_zero"
  | "invalid_match";

/**
 * Calculates the display status for a prediction based on match status and points.
 * This function ensures all predictions are eligible for display, regardless of points.
 */
export const getPredictionDisplayStatus = (
  prediction: Prediction,
  match?: Match
): PredictionDisplayStatus => {
  if (!match) {
    return "invalid_match";
  }

  const matchStatus = match.status;

  // Match is live
  if (matchStatus === "ao_vivo") {
    return "live";
  }

  // Match is not finished - waiting for result
  if (matchStatus !== "encerrado") {
    return "waiting";
  }

  // Match is finished - check points
  if (prediction.points > 0) {
    return "scored_win";
  }

  // Match is finished but prediction has 0 points
  return "scored_zero";
};

/**
 * Gets the display label for a prediction status
 */
export const getPredictionStatusLabel = (status: PredictionDisplayStatus): string => {
  switch (status) {
    case "waiting":
      return "Aguardando";
    case "live":
      return "Ao vivo";
    case "scored_win":
      return "Acertou";
    case "scored_partial":
      return "Acertou parcialmente";
    case "scored_zero":
      return "Errou";
    case "invalid_match":
      return "Partida não encontrada";
  }
};

/**
 * Gets the tone/color for a prediction status
 */
export const getPredictionStatusTone = (status: PredictionDisplayStatus): string => {
  switch (status) {
    case "waiting":
      return "gold";
    case "live":
      return "blue";
    case "scored_win":
      return "green";
    case "scored_partial":
      return "yellow";
    case "scored_zero":
      return "red";
    case "invalid_match":
      return "gray";
  }
};

/**
 * Determines the category bucket for filtering predictions
 * Returns: "all" | "scored" | "waiting" | "live"
 */
export const getPredictionCategory = (
  prediction: Prediction,
  match?: Match
): "all" | "scored" | "waiting" | "live" => {
  const status = getPredictionDisplayStatus(prediction, match);
  
  if (status === "live") return "live";
  if (status === "waiting") return "waiting";
  if (status === "scored_win" || status === "scored_zero") return "scored";
  
  return "all";
};
