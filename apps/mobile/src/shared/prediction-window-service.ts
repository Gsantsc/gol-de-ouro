import type { ApprovalStatus } from "./types";
import { calculateMatchStatus, resolvePredictionWindow, type MatchStatusInput } from "./match-status-engine";

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
  closed: "Este jogo já não aceita novos palpites.",
  notApproved: "Apenas usuários aprovados podem enviar palpites.",
  notOpen: "Palpites abrem 24h antes do jogo.",
  open: "Palpite permitido.",
  pastClose: "Palpites encerram 1h antes do jogo."
} as const;

export const getPredictionWindowState = (match: MatchStatusInput, now = new Date()): PredictionWindowState => {
  const calculatedStatus = calculateMatchStatus(match, now);
  if (calculatedStatus === "encerrado" || calculatedStatus === "ao_vivo") return "closed";

  const { closeAt, openAt } = resolvePredictionWindow(match);
  if (now < openAt) return "not_open";
  if (now >= closeAt) return "closed";
  return "open";
};

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
): PredictionAccessResult => {
  if (!isApproved(profile)) {
    return {
      allowed: false,
      message: predictionAccessMessages.notApproved,
      state: "closed"
    };
  }

  const state = getPredictionWindowState(match, now);
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
      message: calculateMatchStatus(match, now) === "ao_vivo"
        ? predictionAccessMessages.pastClose
        : predictionAccessMessages.closed,
      state
    };
  }

  return {
    allowed: calculateMatchStatus(match, now) === "aberto",
    message: predictionAccessMessages.open,
    state
  };
};
