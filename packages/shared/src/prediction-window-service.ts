import type { ApprovalStatus } from "./types";
import {
  calculateMatchStatus,
  normalizePredictionLockMinutes,
  resolvePredictionWindow,
  type MatchStatusInput
} from "./match-status-engine";
import { hasUndefinedParticipant } from "./team-display";

export type PredictionWindowState = "not_open" | "open" | "closed";

export type PredictionAccessProfile = {
  approval_status?: ApprovalStatus | null;
  blocked?: boolean | null;
  status?: ApprovalStatus | null;
};

export type PredictionAccessResult = {
  allowed: boolean;
  message: string;
  state: PredictionWindowState;
};

export const predictionAccessMessages = {
  closed: "Palpites encerrados para esta partida.",
  notApproved: "Apenas usuarios aprovados podem enviar palpites.",
  notOpen: "Palpites abrem 24h antes da partida.",
  open: "Palpite permitido.",
  pastClose: "Palpites encerrados para esta partida."
} as const;

export const getPredictionWindowState = (
  match: MatchStatusInput,
  now = new Date(),
  predictionLockMinutes?: number | null,
): PredictionWindowState => {
  const calculatedStatus = calculateMatchStatus(match, now, predictionLockMinutes);
  if (calculatedStatus === "encerrado" || calculatedStatus === "ao_vivo") return "closed";

  const { closeAt, openAt } = resolvePredictionWindow(match, predictionLockMinutes);
  if (now < openAt) return "not_open";
  if (now >= closeAt) return "closed";
  return "open";
};

export const predictionLockMessage = (predictionLockMinutes?: number | null) =>
  `Palpites encerram ${normalizePredictionLockMinutes(predictionLockMinutes)} minutos antes do jogo.`;

const isApproved = (profile?: PredictionAccessProfile | null) => {
  if (!profile) return true;
  const status = profile.status ?? (profile.blocked ? "suspended" : profile.approval_status);
  return status === "approved" && !profile.blocked;
};

// PREDICTION ACCESS GUARD
export const canSubmitPrediction = (
  match: MatchStatusInput,
  profile?: PredictionAccessProfile | null,
  now = new Date(),
  predictionLockMinutes?: number | null,
): PredictionAccessResult => {
  if (!isApproved(profile)) {
    return {
      allowed: false,
      message: predictionAccessMessages.notApproved,
      state: "closed"
    };
  }

  const state = getPredictionWindowState(match, now, predictionLockMinutes);
  if (state === "not_open") {
    return {
      allowed: false,
      message: predictionAccessMessages.notOpen,
      state
    };
  }

  if (state === "closed") {
    return {
      allowed: false,
      message: calculateMatchStatus(match, now, predictionLockMinutes) === "ao_vivo"
        ? predictionAccessMessages.pastClose
        : predictionAccessMessages.closed,
      state
    };
  }

  return {
    allowed: calculateMatchStatus(match, now, predictionLockMinutes) === "aberto",
    message: predictionAccessMessages.open,
    state
  };
};

export const canCreatePrediction = (
  match: MatchStatusInput & { home_team?: string | null; away_team?: string | null },
  profile?: PredictionAccessProfile | null,
  now = new Date(),
  predictionLockMinutes?: number | null,
): PredictionAccessResult => {
  if (hasUndefinedParticipant(match)) {
    return {
      allowed: false,
      message: "Times ainda nao definidos para esta partida.",
      state: "closed"
    };
  }

  return canSubmitPrediction(match, profile, now, predictionLockMinutes);
};
