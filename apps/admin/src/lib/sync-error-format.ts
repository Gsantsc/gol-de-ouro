type ParsedSyncError = {
  code?: string;
  hint?: string;
  message?: string;
};

const parseSyncErrorPayload = (value: string): ParsedSyncError | null => {
  const trimmed = value.trim();
  if (!trimmed.startsWith("{")) return null;

  try {
    const parsed = JSON.parse(trimmed) as ParsedSyncError;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};

const formatPostgres21000Error = (technicalMessage?: string) => {
  const details = technicalMessage?.trim()
    || "ON CONFLICT DO UPDATE command cannot affect row a second time";

  return [
    "Erro na sincronização: payload de classificação possui registros duplicados para a mesma chave de conflito.",
    `Detalhes técnicos: ${details}`,
    "Ação sugerida: deduplicar payload antes do upsert."
  ].join("\n");
};

export const formatSyncErrorForDisplay = (error: unknown): string => {
  if (error === null || error === undefined) return "";

  if (typeof error === "string") {
    const parsed = parseSyncErrorPayload(error);
    if (parsed?.code === "21000") {
      return formatPostgres21000Error(parsed.message);
    }
    if (error.includes("21000") || error.includes("cannot affect row a second time")) {
      return formatPostgres21000Error(error);
    }
    return error;
  }

  if (error instanceof Error) {
    return formatSyncErrorForDisplay(error.message);
  }

  if (Array.isArray(error)) {
    return error.map((item) => formatSyncErrorForDisplay(item)).filter(Boolean).join("\n");
  }

  if (typeof error === "object") {
    const record = error as ParsedSyncError;
    if (record.code === "21000") {
      return formatPostgres21000Error(record.message);
    }
    if (typeof record.message === "string" && record.message.trim()) {
      return formatSyncErrorForDisplay(record.message);
    }

    try {
      return formatSyncErrorForDisplay(JSON.stringify(error));
    } catch {
      return String(error);
    }
  }

  return String(error);
};
