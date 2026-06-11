export * from "./types";
export * from "./local-provider";
export * from "./api-football-provider";
export * from "./wc2026-provider";
export * from "./static-wc2026-provider";

import { createApiFootballProvider } from "./api-football-provider";
import { createWC2026Provider } from "./wc2026-provider";
import { localMatchesProvider } from "./local-provider";
import { staticWC2026Provider } from "./static-wc2026-provider";
import type { ChampionshipKey } from "../../types";
import type { MatchesProvider } from "./types";

export type MatchesProviderName = "local-fixtures" | "api-football" | "wc2026" | "static-wc2026";

// API FOOTBALL FIX - Added date range parameters to config
export type MatchesProviderConfig = {
  apiFootballKey?: string;
  wc2026ApiKey?: string;
  baseUrl?: string;
  includeDetails?: boolean;
  providerName?: MatchesProviderName;
  fallbackProviderName?: MatchesProviderName;
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
  fallbackProviderName = "local-fixtures",
  season,
  seasonByChampionship,
  timezone,
  fromDate,
  toDate,
}: MatchesProviderConfig = {}): MatchesProvider => {
  const providerFor = (name: MatchesProviderName): MatchesProvider => {
    if (name === "wc2026" && wc2026ApiKey) {
      return createWC2026Provider({
        apiKey: wc2026ApiKey,
        baseUrl,
      });
    }

    // static-wc2026 is a backend fallback only; frontend apps keep reading Supabase.
    if (name === "static-wc2026") return staticWC2026Provider;

    return localMatchesProvider;
  };

  if (providerName === "wc2026" && wc2026ApiKey) {
    return createWC2026Provider({
      apiKey: wc2026ApiKey,
      baseUrl,
    });
  }

  if (providerName === "api-football" && apiFootballKey) {
    const primary = createApiFootballProvider({
      apiKey: apiFootballKey,
      baseUrl,
      includeDetails,
      season,
      seasonByChampionship,
      timezone,
      fromDate,
      toDate,
    });
    const fallback = providerFor(fallbackProviderName);

    return {
      name: primary.name,
      listMatches: async () => {
        try {
          const matches = await primary.listMatches();
          if (matches.length > 0) return matches;
          console.warn(`API-Football returned 0 fixtures. Using fallback provider ${fallbackProviderName}.`);
        } catch (error) {
          console.warn(
            `API-Football failed. Using fallback provider ${fallbackProviderName}. ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
        return fallback.listMatches();
      },
    };
  }

  return localMatchesProvider;
};
