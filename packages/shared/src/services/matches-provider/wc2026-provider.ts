// WC2026 PROVIDER
// WORLD CUP ONLY MODE
// TEMP API MIGRATION
import type { MatchStatus } from "../../types";
import type { MatchesProvider, ProviderMatch, ProviderMatchEvent, ProviderMatchStats } from "./types";

const debugLog = (...args: unknown[]) => {
  if (process.env.NODE_ENV !== "production") console.log(...args);
};

// WC2026 API CLIENT
type WC2026ProviderOptions = {
  apiKey: string;
  baseUrl?: string;
};

// WC2026 API Response Types
type WC2026Match = {
  id: number;
  match_number?: number;
  round: string;
  group_name?: string;
  home_team: string | null;
  away_team: string | null;
  stadium: string;
  kickoff_utc: string;
  status: string;
  home_score?: number;
  away_score?: number;
};

type WC2026ApiResponse = WC2026Match[] | { matches: WC2026Match[] } | { data: WC2026Match[] };

const defaultStats = (): ProviderMatchStats => ({
  possessionAway: 50,
  possessionHome: 50,
  shotsAway: 0,
  shotsHome: 0,
  shotsOnGoalAway: 0,
  shotsOnGoalHome: 0,
  cornersAway: 0,
  cornersHome: 0,
  foulsAway: 0,
  foulsHome: 0,
  redCardsAway: 0,
  redCardsHome: 0,
  xgAway: 0,
  xgHome: 0,
  yellowCardsAway: 0,
  yellowCardsHome: 0,
});

const statusFromApi = (status?: string): MatchStatus => {
  if (!status || status.toLowerCase() === "scheduled") return "aberto";
  if (status.toLowerCase() === "finished" || status.toLowerCase() === "completed") return "encerrado";
  if (status.toLowerCase() === "live" || status.toLowerCase() === "in_progress") return "ao_vivo";
  return "fechado";
};

// WC2026 API CLIENT
const fetchWC2026 = async (endpoint: string, apiKey: string, baseUrl: string = "https://api.wc2026api.com") => {
  const url = `${baseUrl.replace(/\/$/, "")}/${endpoint.replace(/^\//, "")}`;
  
  debugLog(`WC2026 API REQUEST: ${endpoint}`);
  
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${process.env.WC2026_API_KEY}`,
    },
    signal: AbortSignal.timeout(30000),
  });

  const raw = await response.json();

  debugLog("WC2026 RAW RESPONSE:");
  debugLog(JSON.stringify(raw, null, 2));

  if (!response.ok) {
    console.error(`WC2026 API ERROR: HTTP ${response.status}`);
    if (response.status === 401) {
      throw new Error("WC2026 API: Chave de API invalida ou expirada. Verifique WC2026_API_KEY.");
    }
    if (response.status === 429) {
      throw new Error("WC2026 API: Limite de requisições excedido. Aguarde antes de tentar novamente.");
    }
    if (response.status >= 500) {
      throw new Error(`WC2026 API: Erro do servidor (${response.status}). Tente novamente mais tarde.`);
    }
    throw new Error(`WC2026 API retornou HTTP ${response.status}.`);
  }

  // Try different response structures
  const json = raw as WC2026ApiResponse;
  let matches: WC2026Match[] = [];
  
  if (Array.isArray(json)) {
    matches = json;
  } else if ('matches' in json && Array.isArray(json.matches)) {
    matches = json.matches;
  } else if ('data' in json && Array.isArray(json.data)) {
    matches = json.data;
  }
  
  debugLog(`WC2026 API RESPONSE: ${matches.length} matches`);
  
  return matches;
};

// MATCH ADAPTER
const matchFromApi = (apiMatch: WC2026Match): ProviderMatch => {
  const homeScore = apiMatch.home_score ?? 0;
  const awayScore = apiMatch.away_score ?? 0;
  const status = statusFromApi(apiMatch.status);
  
  return {
    externalId: String(apiMatch.id),
    championship: "world_cup_2026",
    homeTeam: apiMatch.home_team || "TBD",
    awayTeam: apiMatch.away_team || "TBD",
    homeLogoUrl: null,
    awayLogoUrl: null,
    kickoff: apiMatch.kickoff_utc,
    stadium: apiMatch.stadium || "Estadio a confirmar",
    round: apiMatch.round || "Rodada",
    hasFinalScore: status === "encerrado" && apiMatch.home_score != null && apiMatch.away_score != null,
    status,
    homeScore,
    awayScore,
    stats: defaultStats(),
    events: [],
  };
};

export const createWC2026Provider = ({
  apiKey,
  baseUrl = "https://api.wc2026api.com",
}: WC2026ProviderOptions): MatchesProvider => ({
  name: "wc2026",
  listMatches: async () => {
    debugLog("WC2026 PROVIDER: Starting sync");
    
    if (!apiKey) {
      throw new Error("WC2026_API_KEY not configured");
    }
    
    // Mask API key in logs
    const maskedKey = apiKey.length > 8 
      ? `wc26...${apiKey.slice(-4)}` 
      : "wc26****";
    debugLog(`WC2026 API KEY LOADED: ${maskedKey}`);
    
    try {
      const matches = await fetchWC2026("matches", apiKey, baseUrl);
      
      debugLog(`WC2026 PROVIDER: fetched ${matches.length}`);
      
      const providerMatches = matches.map(matchFromApi);
      
      debugLog(`WC2026 PROVIDER: mapped ${providerMatches.length}`);
      
      return providerMatches;
    } catch (error) {
      console.error(`WC2026 PROVIDER ERROR: ${error instanceof Error ? error.message : "Unknown"}`);
      throw error;
    }
  },
});

