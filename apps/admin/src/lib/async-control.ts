const DEFAULT_SUPABASE_TIMEOUT_MS = 15000;

const configuredTimeoutMs = Number(process.env.NEXT_PUBLIC_SUPABASE_REQUEST_TIMEOUT_MS);

export const supabaseRequestTimeoutMs =
  Number.isFinite(configuredTimeoutMs) && configuredTimeoutMs > 0
    ? configuredTimeoutMs
    : DEFAULT_SUPABASE_TIMEOUT_MS;

export const withSupabaseTimeout = async <Result,>(
  operation: PromiseLike<Result>,
  message = "Tempo esgotado ao comunicar com o Supabase.",
  timeoutMs = supabaseRequestTimeoutMs,
): Promise<Result> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([Promise.resolve(operation), timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};
