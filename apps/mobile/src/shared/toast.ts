/**
 * Toast notification system for consistent user feedback across all platforms
 * Provides success, error, warning, and info notifications
 */

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

/**
 * Default toast duration in milliseconds
 */
export const DEFAULT_TOAST_DURATION = 3000;

/**
 * Toast type configurations for styling
 */
export const TOAST_CONFIGS = {
  success: {
    icon: "✓",
    color: "#22c55e",
    bgColor: "rgba(34, 197, 94, 0.1)",
    borderColor: "rgba(34, 197, 94, 0.4)"
  },
  error: {
    icon: "✕",
    color: "#ef4444",
    bgColor: "rgba(239, 68, 68, 0.1)",
    borderColor: "rgba(239, 68, 68, 0.4)"
  },
  warning: {
    icon: "⚠",
    color: "#f59e0b",
    bgColor: "rgba(245, 158, 11, 0.1)",
    borderColor: "rgba(245, 158, 11, 0.4)"
  },
  info: {
    icon: "ℹ",
    color: "#3b82f6",
    bgColor: "rgba(59, 130, 246, 0.1)",
    borderColor: "rgba(59, 130, 246, 0.4)"
  }
} as const;

/**
 * Common toast messages
 */
export const TOAST_MESSAGES = {
  // Auth
  LOGIN_SUCCESS: "Login efetuado com sucesso",
  SIGNUP_SUCCESS: "Cadastro realizado com sucesso",
  LOGOUT_SUCCESS: "Logout efetuado",
  AWAITING_APPROVAL: "Aguardando aprovação do administrador",
  
  // User actions
  USER_APPROVED: "Usuário aprovado com sucesso",
  USER_REJECTED: "Usuário rejeitado",
  USER_SUSPENDED: "Usuário suspenso",
  USER_REACTIVATED: "Usuário reativado",
  
  // Predictions
  PREDICTION_SENT: "Palpite enviado com sucesso",
  PREDICTION_LOCKED: "Palpite enviado. Não é mais possível editar.",
  PREDICTION_ERROR: "Erro ao enviar palpite",
  
  // Groups
  GROUP_CREATED: "Liga criada com sucesso",
  GROUP_JOINED: "Você entrou na liga",
  GROUP_LEFT: "Você saiu da liga",
  GROUP_CLOSED: "Liga fechada",
  INVITE_ACCEPTED: "Convite aceito",
  INVITE_INVALID: "Convite inválido",
  
  // Competitions
  COMPETITION_CREATED: "Competição criada com sucesso",
  
  // Matches
  MATCHES_SYNCED: "Jogos sincronizados com sucesso",
  MATCH_SYNC_ERROR: "Erro ao sincronizar jogos",
  
  // General
  ERROR_OCCURRED: "Ocorreu um erro. Tente novamente.",
  SUCCESS: "Operação realizada com sucesso"
} as const;
