import { calculateMatchStatus, predictionWindowPayload } from "../match-status-engine";
import type { Match, MatchStatus } from "../types";

export type LiveResultProviderName = "none" | "api-football" | "worldcupapi";

export type LiveResultPayload = {
  awayScore?: number | null;
  finished?: boolean;
  homeScore?: number | null;
  providerExternalId: string;
  status?: MatchStatus | null;
};

export type LiveResultSyncDecision = {
  away_score?: number;
  home_score?: number;
  live_score?: { away: number; home: number };
  prediction_close_at: string;
  prediction_open_at: string;
  status: MatchStatus;
};

export const shouldCheckLiveResult = (match: Pick<Match, "start_time" | "status">, now = new Date()) => {
  if (match.status === "encerrado") return false;
  const startAt = new Date(match.start_time);
  if (Number.isNaN(startAt.getTime())) return false;
  const twoHoursBefore = new Date(startAt.getTime() - 2 * 60 * 60 * 1000);
  const fourHoursAfter = new Date(startAt.getTime() + 4 * 60 * 60 * 1000);
  return now >= twoHoursBefore && now <= fourHoursAfter;
};

export const buildLiveResultSyncDecision = (
  match: Pick<Match, "away_score" | "home_score" | "start_time" | "status">,
  result?: LiveResultPayload | null,
  now = new Date(),
): LiveResultSyncDecision => {
  const window = predictionWindowPayload(match.start_time);
  const localStatus = calculateMatchStatus(match, now);
  const status = result?.finished ? "encerrado" : result?.status ?? localStatus;
  const homeScore = result?.homeScore ?? match.home_score ?? 0;
  const awayScore = result?.awayScore ?? match.away_score ?? 0;

  return {
    away_score: awayScore,
    home_score: homeScore,
    live_score: { away: awayScore, home: homeScore },
    prediction_close_at: window.prediction_close_at,
    prediction_open_at: window.prediction_open_at,
    status,
  };
};

export const nextLiveSyncAt = (match: Pick<Match, "start_time" | "status">, now = new Date()) => {
  if (match.status === "encerrado") return null;
  const startAt = new Date(match.start_time);
  if (Number.isNaN(startAt.getTime())) return new Date(now.getTime() + 60 * 60 * 1000).toISOString();

  if (now < new Date(startAt.getTime() - 2 * 60 * 60 * 1000)) {
    return new Date(startAt.getTime() - 2 * 60 * 60 * 1000).toISOString();
  }

  if (now < new Date(startAt.getTime() + 4 * 60 * 60 * 1000)) {
    return new Date(now.getTime() + 5 * 60 * 1000).toISOString();
  }

  return new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString();
};
