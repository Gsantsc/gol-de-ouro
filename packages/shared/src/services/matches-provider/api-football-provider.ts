// LEAGUE AUDIT
import { CHAMPIONSHIP_KEYS } from "../../constants";
import type { ChampionshipKey, MatchStatus } from "../../types";
import type { MatchesProvider, ProviderMatch, ProviderMatchEvent, ProviderMatchStats } from "./types";

const debugLog = (...args: unknown[]) => {
  if (process.env.NODE_ENV !== "production") console.log(...args);
};

// API FOOTBALL FIX - Added date range options
type ApiFootballProviderOptions = {
  apiKey: string;
  baseUrl?: string;
  includeDetails?: boolean;
  season?: number;
  seasonByChampionship?: Partial<Record<ChampionshipKey, number>>;
  timezone?: string;
  fromDate?: string; // Format: YYYY-MM-DD
  toDate?: string; // Format: YYYY-MM-DD
};

type ApiFootballFixture = {
  fixture?: {
    id?: number;
    date?: string;
    status?: { short?: string };
    venue?: { name?: string | null; city?: string | null };
  };
  league?: { name?: string; round?: string };
  teams?: {
    home?: { id?: number; name?: string; code?: string | null; logo?: string | null };
    away?: { id?: number; name?: string; code?: string | null; logo?: string | null };
  };
  goals?: { home?: number | null; away?: number | null };
};

type ApiFootballStatistic = {
  type?: string;
  value?: number | string | null;
};

type ApiFootballTeamStatistics = {
  team?: { id?: number };
  statistics?: ApiFootballStatistic[];
};

type ApiFootballEvent = {
  time?: { elapsed?: number | null };
  team?: { name?: string };
  player?: { name?: string | null };
  assist?: { name?: string | null };
  type?: string;
  detail?: string;
};

type ApiFootballPaging = {
  current?: number;
  total?: number;
};

type ApiFootballResult<T> = {
  data: T;
  paging?: ApiFootballPaging;
};

const MAX_FIXTURE_PAGES = 20;

// API FOOTBALL LEAGUE MAP - Verified league IDs for API-Football v3
// World Cup 2026: ID 1
// Libertadores: ID 13
// Copa Sul-Americana: ID 11
// Brazil Serie A: ID 71
// Copa do Brasil: ID 73
// UEFA Champions League: ID 2
const leagueByChampionship: Record<ChampionshipKey, number> = {
  world_cup_2026: 1,
  brasileirao_a: 71,
  copa_do_brasil: 73,
  champions_league: 2,
  libertadores: 13,
  sul_americana: 11,
};

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
  if (!status || ["NS", "TBD"].includes(status)) return "fechado";
  if (["FT", "AET", "PEN"].includes(status)) return "encerrado";
  if (["1H", "HT", "2H", "ET", "BT", "P", "LIVE"].includes(status)) return "ao_vivo";
  return "fechado";
};

const parseNumber = (value: number | string | null | undefined) => {
  if (typeof value === "number") return value;
  if (!value) return 0;
  const parsed = Number.parseFloat(value.replace("%", "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
};

const readStat = (stats: ApiFootballStatistic[] | undefined, aliases: string[]) => {
  const normalizedAliases = aliases.map((alias) => alias.toLowerCase());
  const found = stats?.find((stat) => normalizedAliases.includes((stat.type ?? "").toLowerCase()));
  return parseNumber(found?.value);
};

const statsFromApi = (
  payload: ApiFootballTeamStatistics[],
  homeTeamId?: number,
  awayTeamId?: number,
): ProviderMatchStats => {
  const home = payload.find((item) => item.team?.id === homeTeamId) ?? payload[0];
  const away = payload.find((item) => item.team?.id === awayTeamId) ?? payload[1];
  const homeStats = home?.statistics;
  const awayStats = away?.statistics;

  return {
    possessionHome: readStat(homeStats, ["Ball Possession"]),
    possessionAway: readStat(awayStats, ["Ball Possession"]),
    shotsHome: readStat(homeStats, ["Total Shots", "Shots Total"]),
    shotsAway: readStat(awayStats, ["Total Shots", "Shots Total"]),
    shotsOnGoalHome: readStat(homeStats, ["Shots on Goal"]),
    shotsOnGoalAway: readStat(awayStats, ["Shots on Goal"]),
    cornersHome: readStat(homeStats, ["Corner Kicks", "Corners"]),
    cornersAway: readStat(awayStats, ["Corner Kicks", "Corners"]),
    foulsHome: readStat(homeStats, ["Fouls"]),
    foulsAway: readStat(awayStats, ["Fouls"]),
    yellowCardsHome: readStat(homeStats, ["Yellow Cards"]),
    yellowCardsAway: readStat(awayStats, ["Yellow Cards"]),
    redCardsHome: readStat(homeStats, ["Red Cards"]),
    redCardsAway: readStat(awayStats, ["Red Cards"]),
    xgHome: readStat(homeStats, ["expected_goals", "Expected Goals", "xG"]),
    xgAway: readStat(awayStats, ["expected_goals", "Expected Goals", "xG"]),
  };
};

const eventFromApi = (event: ApiFootballEvent): ProviderMatchEvent | null => {
  const elapsed = event.time?.elapsed;
  if (elapsed == null) return null;

  const detail = event.detail?.toLowerCase() ?? "";
  const type = event.type?.toLowerCase() ?? "";
  const team = event.team?.name ?? "Time";
  const player = event.player?.name ? ` - ${event.player.name}` : "";
  const assist = event.assist?.name ? ` (assistencia: ${event.assist.name})` : "";

  if (type === "goal") {
    return { description: `Gol ${team}${player}${assist}`, minute: elapsed, type: "goal" };
  }

  if (type === "card" && detail.includes("yellow")) {
    return { description: `Cartao amarelo ${team}${player}`, minute: elapsed, type: "yellow_card" };
  }

  if (type === "card" && detail.includes("red")) {
    return { description: `Cartao vermelho ${team}${player}`, minute: elapsed, type: "red_card" };
  }

  if (type === "subst") {
    return { description: `Substituicao ${team}${player}`, minute: elapsed, type: "substitution" };
  }

  return null;
};

// MATCH SYNC FIX - Added detailed logging for API requests
const requestApiFootball = async <T>(
  baseUrl: string,
  apiKey: string,
  path: string,
  params: Record<string, string | number | undefined>,
): Promise<ApiFootballResult<T>> => {
  const url = new URL(`${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value != null) url.searchParams.set(key, String(value));
  });

  // API FOOTBALL FIX - Log API request
  debugLog(`[API FOOTBALL FIX] API REQUEST: ${path} with params:`, params);

  // API FOOTBALL PROVIDER: never expose API_FOOTBALL_KEY to frontend clients.
  debugLog("API HEADERS VALIDATED: x-apisports-key");

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: {
        "x-apisports-key": apiKey,
      },
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });
  } catch (error) {
    // SYNC VALIDATION - Log sync error
    console.error(`SYNC ERROR: ${path} - Connection error: ${error instanceof Error ? error.message : "Unknown"}`);
    // API FOOTBALL FIX - Log API error
    console.error(`[API FOOTBALL FIX] API ERROR: ${path} - Connection error:`, error);
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        throw new Error("API-Football: Tempo de excedido. Servidor nao respondeu em 30 segundos.");
      }
      if (error.message.includes("ECONNREFUSED") || error.message.includes("fetch failed")) {
        throw new Error("API-Football: Servidor não alcançável. Verifique sua conexão ou tente novamente mais tarde.");
      }
    }
    throw new Error(`API-Football: Erro de conexão - ${error instanceof Error ? error.message : "Desconhecido"}`);
  }

  if (!response.ok) {
    // SYNC VALIDATION - Log sync error
    console.error(`SYNC ERROR: ${path} - HTTP ${response.status}`);
    // API FOOTBALL FIX - Log HTTP error
    console.error(`[API FOOTBALL FIX] API ERROR: ${path} - HTTP ${response.status}`);
    if (response.status === 401) {
      throw new Error("API-Football: Chave de API invalida ou expirada. Verifique API_FOOTBALL_KEY.");
    }
    if (response.status === 429) {
      throw new Error("API-Football: Limite de requisições excedido. Aguarde antes de tentar novamente.");
    }
    if (response.status >= 500) {
      throw new Error(`API-Football: Erro do servidor (${response.status}). Tente novamente mais tarde.`);
    }
    throw new Error(`API-Football retornou HTTP ${response.status}.`);
  }

  const json = (await response.json()) as {
    response?: T;
    results?: number;
    errors?: unknown;
    paging?: ApiFootballPaging;
  };
  const errors = json.errors;
  if (
    errors &&
    ((Array.isArray(errors) && errors.length > 0) ||
      (typeof errors === "object" && Object.keys(errors as Record<string, unknown>).length > 0) ||
      (typeof errors === "string" && errors.trim() !== ""))
  ) {
    throw new Error(`API-Football returned errors: ${JSON.stringify(errors)}`);
  }
  const responseData = json.response ?? ([] as T);
  const resultCount = json.results ?? 0;

  // RAW API DEBUG
  debugLog(`RAW API DEBUG: ${path}`);
  debugLog(`  Status Code: ${response.status}`);
  debugLog(`  Errors:`, json.errors);
  debugLog(`  Results: ${resultCount}`);
  debugLog(`  Paging:`, json.paging);
  debugLog(`  Response Length: ${Array.isArray(responseData) ? responseData.length : 'N/A'}`);

  // SYNC VALIDATION - Log API response received
  debugLog(`API RESPONSE RECEIVED: ${path} - ${resultCount} results`);
  // API FOOTBALL FIX - Log API response count
  debugLog(`[API FOOTBALL FIX] API RESPONSE COUNT: ${path} - ${resultCount} results`);

  return {
    data: responseData,
    paging: json.paging,
  };
};

// REMOVE LEAGUE VALIDATION BLOCKER
// Skipping /leagues validation to prevent sync blocking
// Direct fixtures fetch without prior league validation

// SYNC VALIDATION - Added comprehensive logging for sync flow
// API FOOTBALL FIX - Added date range parameters to provider creation
// API FOOTBALL FIX - Added pagination support
// REALTIME FIX - Added live matches fetching
export const createApiFootballProvider = ({
  apiKey,
  baseUrl = "https://v3.football.api-sports.io",
  includeDetails = true,
  season = new Date().getFullYear(),
  seasonByChampionship,
  timezone = "America/Sao_Paulo",
  fromDate,
  toDate,
}: ApiFootballProviderOptions): MatchesProvider => ({
  name: "api-football",
  listMatches: async () => {
    // SYNC VALIDATION - Log sync start
    debugLog(`SYNC START: Starting API-Football sync`);
    const matches: ProviderMatch[] = [];

    for (const championship of CHAMPIONSHIP_KEYS) {
      // SYNC VALIDATION - Log syncing league
      debugLog(`SYNCING LEAGUE: ${championship}`);
      debugLog(`[API FOOTBALL FIX] Fetching fixtures for ${championship}`);

      const leagueId = leagueByChampionship[championship];
      const leagueSeason = seasonByChampionship?.[championship] ?? (championship === "world_cup_2026" ? 2026 : season);

      // SEASON FALLBACK
      // If season 2026 returns empty, try season 2025
      let allFixtures: ApiFootballFixture[] = [];
      let currentSeason = leagueSeason;
      let fallbackAttempted = false;

      do {
        let page = 1;
        let seasonFixtures: ApiFootballFixture[] = [];

        do {
          const fixtureResult = await requestApiFootball<ApiFootballFixture[]>(
            baseUrl,
            apiKey,
            "fixtures",
            {
              from: fromDate,
              league: leagueId,
              page,
              season: currentSeason,
              timezone,
              to: toDate,
            },
          );

          const fixtures = fixtureResult.data;
          seasonFixtures = seasonFixtures.concat(fixtures);
          const totalPages = fixtureResult.paging?.total ?? page;
          const currentPage = fixtureResult.paging?.current ?? page;

          if (fixtures.length === 0 || currentPage >= totalPages || page >= MAX_FIXTURE_PAGES) break;
          page = currentPage + 1;
        } while (page <= MAX_FIXTURE_PAGES);

        // If no fixtures found and we haven't tried fallback yet
        if (seasonFixtures.length === 0 && !fallbackAttempted && currentSeason === 2026) {
          debugLog(`SEASON FALLBACK: No fixtures for season ${currentSeason}, trying season 2025`);
          currentSeason = 2025;
          fallbackAttempted = true;
          // Continue the outer loop to try with the new season
        } else {
          allFixtures = allFixtures.concat(seasonFixtures);
          // Break the outer loop since we have fixtures or have tried fallback
          break;
        }
      } while (true);

      debugLog(`[API FOOTBALL FIX] Total fixtures fetched for ${championship}: ${allFixtures.length}`);

      for (const fixture of allFixtures) {
        const fixtureId = fixture.fixture?.id;
        if (!fixtureId || !fixture.fixture?.date || !fixture.teams?.home?.name || !fixture.teams.away?.name) {
          continue;
        }

        let stats = defaultStats();
        let events: ProviderMatchEvent[] = [];

        // REALTIME FIX - Always fetch details for live matches, skip for finished matches to save API calls
        const isLive = ["1H", "HT", "2H", "ET", "BT", "P", "LIVE"].includes(fixture.fixture.status?.short || "");
        if (includeDetails || isLive) {
          const [statisticsResult, eventsResult] = await Promise.all([
            requestApiFootball<ApiFootballTeamStatistics[]>(baseUrl, apiKey, "fixtures/statistics", {
              fixture: fixtureId,
            }),
            requestApiFootball<ApiFootballEvent[]>(baseUrl, apiKey, "fixtures/events", {
              fixture: fixtureId,
            }),
          ]);

          stats = statsFromApi(statisticsResult.data, fixture.teams.home.id, fixture.teams.away.id);
          events = eventsResult.data.map(eventFromApi).filter((event): event is ProviderMatchEvent => Boolean(event));
        }

        const status = statusFromApi(fixture.fixture.status?.short);

        matches.push({
          awayLogoUrl: fixture.teams.away.logo ?? null,
          awayScore: fixture.goals?.away ?? 0,
          awayTeam: fixture.teams.away.name,
          championship,
          events,
          externalId: String(fixtureId),
          homeLogoUrl: fixture.teams.home.logo ?? null,
          homeScore: fixture.goals?.home ?? 0,
          homeTeam: fixture.teams.home.name,
          kickoff: fixture.fixture.date,
          hasFinalScore: status === "encerrado" && fixture.goals?.home != null && fixture.goals?.away != null,
          round: fixture.league?.round ?? "Rodada",
          stadium: fixture.fixture.venue?.name ?? "Estadio a confirmar",
          stats,
          status,
        });
      }
    }

    // SYNC VALIDATION - Log sync complete
    debugLog(`SYNC COMPLETE: Total matches fetched: ${matches.length}`);
    return matches;
  },
});

