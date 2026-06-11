export * from "./types";
export * from "./local-provider";
export * from "./api-football-provider";
export * from "./wc2026-provider";

import { createApiFootballProvider } from "./api-football-provider";
import { createWC2026Provider } from "./wc2026-provider";
import { localMatchesProvider } from "./local-provider";
import type { ChampionshipKey } from "../../types";
import type { MatchesProvider } from "./types";

export type MatchesProviderName = "local-fixtures" | "api-football" | "wc2026";

// API FOOTBALL FIX - Added date range parameters to config
export type MatchesProviderConfig = {
  apiFootballKey?: string;
  wc2026ApiKey?: string;
  baseUrl?: string;
  includeDetails?: boolean;
  providerName?: MatchesProviderName;
  season?: number;
  seasonByChampionship?: Partial<Record<ChampionshipKey, number>>;
  timezone?: string;
  fromDate?: string; // Format: YYYY-MM-DD
  toDate?: string; // Format: YYYY-MM-DD
};

export const createMatchesProvider = ({
  apiFootballKey,
  wc2026ApiKey,
  baseUrl,
  includeDetails,
  providerName = "local-fixtures",
  season,
  seasonByChampionship,
  timezone,
  fromDate,
  toDate,
}: MatchesProviderConfig = {}): MatchesProvider => {
  if (providerName === "wc2026" && wc2026ApiKey) {
    return createWC2026Provider({
      apiKey: wc2026ApiKey,
      baseUrl,
    });
  }

  if (providerName === "api-football" && apiFootballKey) {
    return createApiFootballProvider({
      apiKey: apiFootballKey,
      baseUrl,
      includeDetails,
      season,
      seasonByChampionship,
      timezone,
      fromDate,
      toDate,
    });
  }

  return localMatchesProvider;
};
