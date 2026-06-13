/**
 * Centralized error handling utilities for the application
 * Provides consistent error messages across admin, web, and mobile platforms
 */

/**
 * Generic error reader that extracts the message from an Error object
 */
export const readError = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Ocorreu um erro inesperado.";
};

/**
 * Authentication-specific error reader with user-friendly messages
 * Handles common Supabase auth errors and converts them to Portuguese
 */
export const readAuthError = (error: unknown): string => {
  const message = readError(error).toLowerCase();

  if (message.includes("email not confirmed")) {
    return "Seu email ainda não foi confirmado.";
  }

  if (message.includes("invalid login credentials") || message.includes("user not found")) {
    return "Email ou senha incorretos.";
  }

  // Account status errors
  if (message.includes("suspended") || message.includes("blocked")) {
    return "Sua conta foi suspensa. Entre em contato com o administrador.";
  }

  if (message.includes("pending") || message.includes("approval")) {
    return "Seu cadastro ainda está aguardando aprovação.";
  }

  if (message.includes("rejected")) {
    return "Seu cadastro foi rejeitado pelo administrador.";
  }

  // Email already exists
  if (message.includes("user already registered") || message.includes("duplicate")) {
    return "Este email já está cadastrado.";
  }

  // Weak password
  if (message.includes("password") && (message.includes("weak") || message.includes("too short"))) {
    return "A senha deve ter pelo menos 6 caracteres.";
  }

  // Invalid email format
  if (message.includes("email") && message.includes("invalid")) {
    return "Email inválido. Verifique o formato.";
  }

  // Network/connection errors
  if (message.includes("network") || message.includes("connection") || message.includes("fetch")) {
    return "Erro de conexão. Verifique sua internet e tente novamente.";
  }

  // Rate limiting
  if (
    message.includes("rate limit")
    || message.includes("rate_limit")
    || message.includes("too many requests")
    || message.includes("too many attempts")
    || message.includes("muitas tentativas")
    || message.includes("security purposes")
  ) {
    return "Muitas tentativas de acesso. Aguarde alguns minutos.";
  }

  // Session errors
  if (message.includes("session") || message.includes("token")) {
    return "Sessão expirada. Faça login novamente.";
  }

  return "Não foi possível autenticar. Tente novamente.";
};

/**
 * Database/Supabase-specific error reader
 * Handles common database errors and converts them to user-friendly messages
 */
export const readDatabaseError = (error: unknown): string => {
  const message = readError(error).toLowerCase();

  // Permission errors
  if (message.includes("permission denied") || message.includes("insufficient privilege")) {
    return "Você não tem permissão para realizar esta ação.";
  }

  // Not found errors
  if (message.includes("not found") || message.includes("no rows")) {
    return "Registro não encontrado.";
  }

  // Constraint violations
  if (message.includes("unique constraint") || message.includes("duplicate key")) {
    return "Este registro já existe.";
  }

  if (message.includes("foreign key") || message.includes("violates")) {
    return "Não é possível excluir este registro pois está em uso.";
  }

  // Default to generic error
  return readError(error);
};
