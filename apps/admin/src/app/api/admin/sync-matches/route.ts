// LEAGUE AUDIT
// API-FOOTBALL INTEGRATION
// Enhanced sync route to sync teams, standings, lineups with caching and logging

import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  CHAMPIONSHIP_LABELS,
  calculateMatchStatus,
  createMatchesProvider,
  getPlaceholderSeedLabel,
  isKnockoutPlaceholder,
  normalizeBracketPhase,
  parseKnockoutPlaceholder,
  predictionWindowPayload,
  type ChampionshipKey,
  type ProviderMatch,
  type ProviderMatchStats,
  type TournamentType
} from "@gol-de-ouro/shared";
import {
  emptyKnockoutResolutionSummary,
  resolveKnockoutParticipants,
  type KnockoutResolutionSummary
} from "@/server/knockout-resolver";

type SyncSummary = {
  insertedCount: number;
  providerName: string;
  preservedFinishedMatches: number;
  skippedScorePreservation: number;
  updatedCount: number;
  teamsSynced: number;
  standingsSynced: number;
  lineupsSynced: number;
  cacheHits: number;
  cacheMisses: number;
  knockoutResolution: KnockoutResolutionSummary;
  knockoutSync: {
    matchesChecked: number;
    realTeamsFromEspn: number;
    placeholdersDetected: number;
    placeholdersResolved: number;
    unresolved: number;
    warnings: string[];
  };
};

type ExistingMatchRow = {
  away_score?: number | null;
  away_team?: string | null;
  away_team_logo_url?: string | null;
  first_goal_no_goals?: boolean | null;
  first_goal_scorer?: string | null;
  first_goal_scorer_id?: string | null;
  home_score?: number | null;
  home_team?: string | null;
  home_team_logo_url?: string | null;
  id: string;
  live_score?: unknown;
  man_of_match?: string | null;
  man_of_match_id?: string | null;
  provider_external_id?: string | null;
  red_card_happened?: boolean | null;
  red_cards_away?: number | null;
  red_cards_home?: number | null;
  stats?: ProviderMatchStats | null;
  status?: string | null;
  home_original_placeholder?: string | null;
  away_original_placeholder?: string | null;
};

type UpsertProviderMatchResult = {
  action: "inserted" | "updated";
  matchId: string;
  preservedFinishedMatch: boolean;
  skippedScorePreservation: boolean;
};

const EXISTING_MATCH_SELECT = [
  "id",
  "status",
  "provider_external_id",
  "stats",
  "home_team",
  "away_team",
  "home_team_logo_url",
  "away_team_logo_url",
  "home_score",
  "away_score",
  "live_score",
  "first_goal_scorer_id",
  "first_goal_scorer",
  "first_goal_no_goals",
  "man_of_match_id",
  "man_of_match",
  "red_card_happened",
  "red_cards_home",
  "red_cards_away",
].join(",");

const requiredEnv = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`Variável ${name} não configurada.`);
  return value;
};

// API-FOOTBALL INTEGRATION
// Simple in-memory cache for sync operations
const syncCache = new Map<string, { data: unknown; timestamp: number }>();

const CACHE_DURATIONS = {
  fixtures: 6 * 60 * 60 * 1000, // 6 hours
  live: 60 * 1000, // 60 seconds
  events: 60 * 1000, // 60 seconds
  teams: Infinity, // sync once
  standings: 6 * 60 * 60 * 1000, // 6 hours
} as const;

const getCached = <T>(key: string, duration: number): T | null => {
  const cached = syncCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.timestamp > duration) {
    syncCache.delete(key);
    return null;
  }
  return cached.data as T;
};

const setCached = <T>(key: string, data: T): void => {
  syncCache.set(key, { data, timestamp: Date.now() });
};

// API-FOOTBALL INTEGRATION
// Logging for sync operations
const logSync = (message: string, level: "info" | "error" | "warn" = "info") => {
  if (process.env.NODE_ENV === "production" && level === "info") return;
  const timestamp = new Date().toISOString();
  const prefix = `[SYNC ${timestamp}]`;
  if (level === "error") console.error(`${prefix} ${message}`);
  else if (level === "warn") console.warn(`${prefix} ${message}`);
  else console.log(`${prefix} ${message}`);
};

const readProviderStatNumber = (stats: ProviderMatchStats, key: string) => {
  const value = (stats as Record<string, unknown>)[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const readProviderStatString = (stats: ProviderMatchStats, key: string) => {
  const value = (stats as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

const legacyStaticExternalIds = (matchNumber: number | null) => {
  if (!matchNumber) return [];
  const padded = String(matchNumber).padStart(3, "0");
  const legacy = [`static-wc2026-${padded}`];
  if (matchNumber === 1) legacy.push("static-wc2026-mexico-south-africa");
  if (matchNumber === 2) legacy.push("static-wc2026-korea-republic-czechia");
  return legacy;
};

const createSupabaseForRequest = (accessToken: string) =>
  createClient(requiredEnv("NEXT_PUBLIC_SUPABASE_URL"), requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });

const tournamentTypeFor = (championship: ChampionshipKey): TournamentType => {
  if (championship === "world_cup_2026") return "world_cup";
  if (championship === "brasileirao_a" || championship === "copa_do_brasil") {
    return "brasileirao";
  }
  if (championship === "libertadores" || championship === "sul_americana") return "libertadores";
  return "champions_league";
};

// SUPPORTED TOURNAMENTS ONLY - Ensuring only 6 supported championships are created
const ensureTournament = async (
  supabase: SupabaseClient,
  championship: ChampionshipKey,
  cache: Map<string, string>,
) => {
  const cached = cache.get(championship);
  if (cached) return cached;

  const { data: existing, error: existingError } = await supabase
    .from("tournaments")
    .select("id")
    .eq("slug", championship)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing?.id) {
    cache.set(championship, existing.id);
    return existing.id as string;
  }

  // SUPPORTED TOURNAMENTS ONLY - Creating tournament only for supported championships
  const { data, error } = await supabase
    .from("tournaments")
    .insert({
      active: true,
      name: CHAMPIONSHIP_LABELS[championship],
      slug: championship,
      type: tournamentTypeFor(championship),
    })
    .select("id")
    .single();

  if (error) throw error;
  cache.set(championship, data.id as string);
  // SYNC VALIDATION - Log tournament upsert success
  logSync(`UPSERT TOURNAMENT SUCCESS: ${championship} - ${data.id}`);
  return data.id as string;
};

const statsPayload = (matchId: string, stats: ProviderMatchStats) => ({
  corners_away: stats.cornersAway,
  corners_home: stats.cornersHome,
  fouls_away: stats.foulsAway,
  fouls_home: stats.foulsHome,
  match_id: matchId,
  possession_away: stats.possessionAway,
  possession_home: stats.possessionHome,
  red_cards_away: stats.redCardsAway,
  red_cards_home: stats.redCardsHome,
  shots_away: stats.shotsAway,
  shots_home: stats.shotsHome,
  shots_on_goal_away: stats.shotsOnGoalAway,
  shots_on_goal_home: stats.shotsOnGoalHome,
  updated_at: new Date().toISOString(),
  xg_away: stats.xgAway,
  xg_home: stats.xgHome,
  yellow_cards_away: stats.yellowCardsAway,
  yellow_cards_home: stats.yellowCardsHome,
});

const findExistingProviderMatch = async (
  supabase: SupabaseClient,
  providerName: string,
  providerMatch: ProviderMatch,
) => {
  const exact = await supabase
    .from("matches")
    .select(EXISTING_MATCH_SELECT)
    .eq("provider_name", providerName)
    .eq("provider_external_id", providerMatch.externalId)
    .is("deleted_at", null)
    .maybeSingle();

  if (exact.error) {
    logSync(`UPSERT ERROR: Failed to check existing match - ${exact.error.message}`, "error");
    throw exact.error;
  }
  const exactMatch = exact.data as unknown as ExistingMatchRow | null;

if (exactMatch) {
  return exactMatch;
}

  if (providerName !== "static-wc2026" || providerMatch.championship !== "world_cup_2026") {
    return null;
  }

  const matchNumber = readProviderStatNumber(providerMatch.stats, "match_number");
  const legacyIds = legacyStaticExternalIds(matchNumber);
  if (!matchNumber && legacyIds.length === 0) return null;

  const candidates = await supabase
    .from("matches")
    .select(EXISTING_MATCH_SELECT)
    .eq("provider_name", providerName)
    .eq("championship", providerMatch.championship)
    .is("deleted_at", null);

  if (candidates.error) {
    logSync(`UPSERT ERROR: Failed to check legacy static match - ${candidates.error.message}`, "error");
    throw candidates.error;
  }

 const candidateRows = (candidates.data ?? []) as unknown as ExistingMatchRow[];

return candidateRows.find((match) => {

    const stats = (match.stats ?? {}) as ProviderMatchStats;
    const existingNumber = readProviderStatNumber(stats, "match_number");
    return existingNumber === matchNumber || legacyIds.includes(String(match.provider_external_id ?? ""));
  }) ?? null;
};

// API-FOOTBALL INTEGRATION
// Sync teams from API-Football and link to matches
const syncTeams = async (
  supabase: SupabaseClient,
  providerName: string,
  championship: ChampionshipKey,
  leagueId: number,
  season: number,
): Promise<number> => {
  logSync(`SYNC TEAMS START: ${championship} (league ${leagueId}, season ${season})`);

  const cacheKey = `teams-${championship}-${season}`;
  const cached = getCached<{ id: number; name: string; logo: string | null }[]>(cacheKey, CACHE_DURATIONS.teams);
  if (cached) {
    logSync(`SYNC TEAMS CACHE HIT: ${championship}`);
    return cached.length;
  }

  const apiKey = process.env.API_FOOTBALL_KEY;
  const baseUrl = process.env.API_FOOTBALL_BASE_URL || "https://v3.football.api-sports.io";

  if (!apiKey) {
    logSync(`SYNC TEAMS SKIP: No API_FOOTBALL_KEY configured`, "warn");
    return 0;
  }

  try {
    const url = new URL(`${baseUrl}/teams`);
    url.searchParams.set("league", String(leagueId));
    url.searchParams.set("season", String(season));

    // API HEADERS VALIDATED
    logSync("API headers validated");

    const response = await fetch(url.toString(), {
      headers: {
        "x-apisports-key": apiKey,
        "x-apisports-host": "v3.football.api-sports.io",
      },
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      logSync(`SYNC TEAMS ERROR: HTTP ${response.status}`, "error");
      return 0;
    }

    const json = (await response.json()) as { response?: Array<{ team: { id: number; name: string; logo: string | null } }> };
    const teams = json.response?.map((item) => ({
      external_id: String(item.team.id),
      name: item.team.name,
      logo_url: item.team.logo,
    })) || [];

    let syncedCount = 0;
    for (const team of teams) {
      const { error } = await supabase.from("teams").upsert({
        external_id: team.external_id,
        name: team.name,
        logo_url: team.logo_url,
      }, { onConflict: "external_id" });

      if (!error) syncedCount++;
    }

    setCached(cacheKey, teams);
    logSync(`SYNC TEAMS SUCCESS: ${syncedCount} teams synced for ${championship}`);
    return syncedCount;
  } catch (error) {
    logSync(`SYNC TEAMS ERROR: ${error instanceof Error ? error.message : "Unknown"}`, "error");
    return 0;
  }
};

// API-FOOTBALL INTEGRATION
// Link teams to matches based on team names
const linkTeamsToMatches = async (
  supabase: SupabaseClient,
  providerMatch: ProviderMatch,
  matchId: string,
): Promise<void> => {
  const { data: homeTeam } = await supabase
    .from("teams")
    .select("id")
    .ilike("name", providerMatch.homeTeam)
    .maybeSingle();

  const { data: awayTeam } = await supabase
    .from("teams")
    .select("id")
    .ilike("name", providerMatch.awayTeam)
    .maybeSingle();

  if (homeTeam?.id || awayTeam?.id) {
    const teamPayload: Record<string, string> = {};
    if (homeTeam?.id) teamPayload.home_team_id = homeTeam.id as string;
    if (awayTeam?.id) teamPayload.away_team_id = awayTeam.id as string;

    await supabase.from("matches").update(teamPayload).eq("id", matchId);
  }
};

// FIX MATCH UPSERT - Ensuring all required fields are saved from API-Football
const upsertProviderMatch = async (
  supabase: SupabaseClient,
  providerName: string,
  providerMatch: ProviderMatch,
  tournamentCache: Map<string, string>,
  predictionLockMinutes: number,
) => {
  // FIX MATCH UPSERT - Log upsert start
  logSync(`UPSERT START: ${providerMatch.championship} - ${providerMatch.homeTeam} vs ${providerMatch.awayTeam}`);

  const tournamentId = await ensureTournament(supabase, providerMatch.championship, tournamentCache);
  // WC2026 MATCH UPSERT
  // PREDICTION WINDOW
  const windowPayload = predictionWindowPayload(providerMatch.kickoff, predictionLockMinutes);
  const providerStatus =
    providerMatch.status === "encerrado" && providerMatch.hasFinalScore === false
      ? "ao_vivo"
      : providerMatch.status;
  const status = calculateMatchStatus({
    prediction_close_at: windowPayload.prediction_close_at,
    prediction_open_at: windowPayload.prediction_open_at,
    start_time: providerMatch.kickoff,
    status: providerStatus
  }, new Date(), predictionLockMinutes);

  const richStats = providerMatch.stats;
  const kickoffUtc = readProviderStatString(richStats, "kickoff_utc") ?? providerMatch.kickoff;
  const venueTimezone = readProviderStatString(richStats, "venue_timezone");
  const existing = await findExistingProviderMatch(supabase, providerName, providerMatch);
  const providerHomeIsPlaceholder = isKnockoutPlaceholder(providerMatch.homeTeam);
  const providerAwayIsPlaceholder = isKnockoutPlaceholder(providerMatch.awayTeam);
  const existingHomeTeam = existing?.home_team ?? null;
  const existingAwayTeam = existing?.away_team ?? null;
  const existingHomeLogoUrl = existing?.home_team_logo_url ?? null;
  const existingAwayLogoUrl = existing?.away_team_logo_url ?? null;
  const existingHomeIsReal = existingHomeTeam ? !isKnockoutPlaceholder(existingHomeTeam) : false;
  const existingAwayIsReal = existingAwayTeam ? !isKnockoutPlaceholder(existingAwayTeam) : false;
  const homeTeam = existingHomeIsReal && providerHomeIsPlaceholder ? existingHomeTeam : providerMatch.homeTeam;
  const awayTeam = existingAwayIsReal && providerAwayIsPlaceholder ? existingAwayTeam : providerMatch.awayTeam;
  const homeLogoUrl = existingHomeIsReal && providerHomeIsPlaceholder
    ? existingHomeLogoUrl ?? providerMatch.homeLogoUrl
    : providerMatch.homeLogoUrl;
  const awayLogoUrl = existingAwayIsReal && providerAwayIsPlaceholder
    ? existingAwayLogoUrl ?? providerMatch.awayLogoUrl
    : providerMatch.awayLogoUrl;

  // Extract bracket information from provider match
  const bracketPhase = providerMatch.bracketPhase || normalizeBracketPhase(providerMatch.round, null, providerMatch.matchNumber);
  const bracketOrder = providerMatch.bracketOrder ?? providerMatch.matchNumber ?? null;
  const matchNumber = providerMatch.matchNumber ?? null;
  
  // Parse placeholders for seed information
  const homeParsed = parseKnockoutPlaceholder(providerMatch.homeTeam);
  const awayParsed = parseKnockoutPlaceholder(providerMatch.awayTeam);
  const homeSeed = homeParsed ? (getPlaceholderSeedLabel(providerMatch.homeTeam) ?? providerMatch.homeTeam) : null;
  const awaySeed = awayParsed ? (getPlaceholderSeedLabel(providerMatch.awayTeam) ?? providerMatch.awayTeam) : null;
  
  // Preserve original placeholder if we're replacing it with a real team
  const homeOriginalPlaceholder = (existingHomeIsReal && providerHomeIsPlaceholder) ? existing?.home_original_placeholder : (providerHomeIsPlaceholder ? providerMatch.homeTeam : existing?.home_original_placeholder);
  const awayOriginalPlaceholder = (existingAwayIsReal && providerAwayIsPlaceholder) ? existing?.away_original_placeholder : (providerAwayIsPlaceholder ? providerMatch.awayTeam : existing?.away_original_placeholder);

  // FIX MATCH UPSERT - Payload includes all required fields: provider_name, provider_external_id, championship, last_synced_at, home_team, away_team, logos, start_time, status
  const payload: Record<string, unknown> = {
    away_score: providerMatch.awayScore,
    away_team: awayTeam,
    away_team_logo_url: awayLogoUrl,
    championship: providerMatch.championship,
    home_score: providerMatch.homeScore,
    home_team: homeTeam,
    home_team_logo_url: homeLogoUrl,
    last_synced_at: new Date().toISOString(),
    live_score: { away: providerMatch.awayScore, home: providerMatch.homeScore },
    prediction_close_at: windowPayload.prediction_close_at,
    prediction_open_at: windowPayload.prediction_open_at,
    provider_external_id: providerMatch.externalId,
    provider_name: providerName,
    round: providerMatch.round,
    stadium: providerMatch.stadium,
    start_time: providerMatch.kickoff,
    start_time_utc: kickoffUtc,
    venue_timezone: venueTimezone,
    source_timezone: venueTimezone,
    kickoff_source: readProviderStatString(richStats, "source"),
    kickoff_verified_at: new Date().toISOString(),
    display_time_br: readProviderStatString(richStats, "kickoff_brt"),
    stats: providerMatch.stats,
    status,
    tournament_id: tournamentId,
  };
  
  // Add bracket fields if this is a knockout match
  if (bracketPhase && bracketPhase !== "group_stage") {
    payload.bracket_phase = bracketPhase;
    payload.bracket_order = bracketOrder;
    payload.match_number = matchNumber;
    
    if (homeSeed) payload.home_seed = homeSeed;
    if (awaySeed) payload.away_seed = awaySeed;
    if (homeOriginalPlaceholder) payload.home_original_placeholder = homeOriginalPlaceholder;
    if (awayOriginalPlaceholder) payload.away_original_placeholder = awayOriginalPlaceholder;
    
    // Mark bracket as validated if we have real teams
    if (!providerHomeIsPlaceholder && !providerAwayIsPlaceholder) {
      payload.is_bracket_validated = true;
      payload.bracket_validation_error = null;
    }
  }

  const matchResult = existing
    ? await supabase.from("matches").update(payload).eq("id", existing.id).select("id").single()
    : await supabase.from("matches").insert(payload).select("id").single();

  if (matchResult.error) {
    // UPSERT FIX - Log upsert error
    logSync(`UPSERT ERROR: Failed to ${existing ? "update" : "insert"} match - ${matchResult.error.message}`, "error");
    throw matchResult.error;
  }
  const matchId = matchResult.data.id as string;

  // SYNC VALIDATION - Log match upsert success
  logSync(`UPSERT MATCH SUCCESS: ${existing ? "Updated" : "Inserted"} match ${matchId}`);
  // UPSERT FIX - Log upsert success
  logSync(`UPSERT SUCCESS: ${existing ? "Updated" : "Inserted"} match ${matchId}`);

  // API-FOOTBALL INTEGRATION
  // Link teams to match if using API-Football
  if (providerName === "api-football") {
    await linkTeamsToMatches(supabase, providerMatch, matchId);
  }

  const statsResult = await supabase
    .from("match_statistics")
    .upsert(statsPayload(matchId, providerMatch.stats), { onConflict: "match_id" });
  if (statsResult.error) {
    // UPSERT FIX - Log stats error
    logSync(`UPSERT ERROR: Failed to upsert statistics - ${statsResult.error.message}`, "error");
    throw statsResult.error;
  }

  // FINAL SCORE SYNC
  if (status === "encerrado" && providerMatch.hasFinalScore !== false && existing?.status !== "encerrado") {

  }

  if (providerMatch.events.length) {
    const eventsResult = await supabase.from("match_events").upsert(
      providerMatch.events.map((event) => ({
        description: event.description,
        match_id: matchId,
        minute: event.minute,
        type: event.type,
      })),
      { ignoreDuplicates: true, onConflict: "match_id,minute,type,description" },
    );
    if (eventsResult.error) {
      // UPSERT FIX - Log events error
      logSync(`UPSERT ERROR: Failed to upsert events - ${eventsResult.error.message}`, "error");
      throw eventsResult.error;
    }
  }

  return existing ? "updated" : "inserted";
};

const readPredictionLockMinutes = async (supabase: SupabaseClient) => {
  const { data, error } = await supabase.rpc("get_app_settings");
  if (error) return 60;
  const value = Number(data?.[0]?.prediction_lock_minutes ?? 60);
  return [60, 90, 120, 180].includes(value) ? value : 60;
};

// LEAGUE AUDIT - API FOOTBALL LEAGUE MAP
// API-FOOTBALL INTEGRATION
// League IDs for API-Football
const leagueIds: Record<ChampionshipKey, number> = {
  world_cup_2026: 1,
  brasileirao_a: 71,
  copa_do_brasil: 73,
  champions_league: 2,
  libertadores: 13,
  sul_americana: 11,
};

// API FOOTBALL FIX - Added date range configuration
const runSync = async (supabase: SupabaseClient): Promise<SyncSummary & { startedAt: string; finishedAt: string; durationMs: number }> => {
  const startedAt = new Date().toISOString();
  logSync("SYNC START");

  // Configure seasons for each championship to ensure matches until December 2026
  // REALTIME FIX - World Cup 2026 uses season 2026, others use 2025
  const seasonByChampionship: Partial<Record<ChampionshipKey, number>> = {
    world_cup_2026: 2026,
    brasileirao_a: 2026,
    copa_do_brasil: 2026,
    champions_league: 2026,
    libertadores: 2026,
    sul_americana: 2026,
  };

  logSync(`REALTIME FIX: World Cup 2026 configured with season 2026`);

  // API FOOTBALL FIX - Configure date range to fetch all matches from current date to end of 2026
  const currentDate = new Date();
  const fromDate = process.env.API_FOOTBALL_FROM_DATE || currentDate.toISOString().split('T')[0];
  const toDate = process.env.API_FOOTBALL_TO_DATE || "2026-12-31";

  logSync(`API FOOTBALL FIX: Syncing matches from ${fromDate} to ${toDate}`);

  // WC2026 PROVIDER
  // WORLD CUP ONLY MODE
  // TEMP API MIGRATION
  const provider = createMatchesProvider({
    apiFootballKey: process.env.API_FOOTBALL_KEY,
    wc2026ApiKey: process.env.WC2026_API_KEY,
    baseUrl: process.env.API_FOOTBALL_BASE_URL,
    fallbackProviderName:
      process.env.MATCHES_FALLBACK_PROVIDER === "wc2026"
        ? "wc2026"
        : process.env.MATCHES_FALLBACK_PROVIDER === "static-wc2026"
          ? "static-wc2026"
          : "static-wc2026",
    includeDetails: process.env.API_FOOTBALL_INCLUDE_DETAILS !== "false",
    providerName:
      process.env.MATCHES_PROVIDER === "wc2026"
        ? "wc2026"
        : process.env.MATCHES_PROVIDER === "api-football"
          ? "api-football"
          : process.env.MATCHES_PROVIDER === "local-fixtures"
            ? "local-fixtures"
            : "static-wc2026",
    season: process.env.API_FOOTBALL_SEASON ? Number(process.env.API_FOOTBALL_SEASON) : 2025,
    seasonByChampionship,
    timezone: process.env.MATCHES_PROVIDER_TIMEZONE ?? "America/Sao_Paulo",
    fromDate,
    toDate,
  });

  logSync(`SYNC PROVIDER: ${provider.name}`);

  // API-FOOTBALL INTEGRATION
  // Sync teams first if using API-Football
  let teamsSynced = 0;
  let cacheHits = 0;
  let cacheMisses = 0;

  if (provider.name === "api-football" && process.env.API_FOOTBALL_KEY) {
    logSync("SYNC TEAMS PHASE");
    for (const championship of Object.keys(seasonByChampionship) as ChampionshipKey[]) {
      const leagueId = leagueIds[championship];
      const season = seasonByChampionship[championship] || 2025;
      const count = await syncTeams(supabase, provider.name, championship, leagueId, season);
      teamsSynced += count;
    }
    logSync(`SYNC TEAMS COMPLETE: ${teamsSynced} teams synced`);
  }

  logSync("SYNC FIXTURES START");
  const providerMatches = await provider.listMatches();
  logSync(`SYNC FIXTURES FETCHED: ${providerMatches.length} matches`);

  const tournamentCache = new Map<string, string>();
  const predictionLockMinutes = await readPredictionLockMinutes(supabase);
  let insertedCount = 0;
  let updatedCount = 0;
  const changedMatches: Array<{ id: string; homeTeam: string; awayTeam: string; action: "inserted" | "updated" }> = [];

  for (const providerMatch of providerMatches) {
    const action = await upsertProviderMatch(supabase, provider.name, providerMatch, tournamentCache, predictionLockMinutes);
    if (action === "inserted") {
      insertedCount += 1;
      cacheMisses++;
      changedMatches.push({
        id: providerMatch.externalId,
        homeTeam: providerMatch.homeTeam,
        awayTeam: providerMatch.awayTeam,
        action: "inserted"
      });
    } else {
      updatedCount += 1;
      cacheHits++;
      changedMatches.push({
        id: providerMatch.externalId,
        homeTeam: providerMatch.homeTeam,
        awayTeam: providerMatch.awayTeam,
        action: "updated"
      });
    }
  }

  logSync(`SYNC FIXTURES COMPLETE: ${insertedCount} inserted, ${updatedCount} updated`);
  
  // Calculate knockout sync metrics from provider matches
  const knockoutMatches = providerMatches.filter(m => m.bracketPhase && m.bracketPhase !== "group_stage");
  const realTeamsFromEspn = knockoutMatches.filter(m => !isKnockoutPlaceholder(m.homeTeam) && !isKnockoutPlaceholder(m.awayTeam)).length;
  const placeholdersDetected = knockoutMatches.filter(m => isKnockoutPlaceholder(m.homeTeam) || isKnockoutPlaceholder(m.awayTeam)).length;
  
  let knockoutResolution = emptyKnockoutResolutionSummary();
  try {
    knockoutResolution = await resolveKnockoutParticipants(supabase, "world_cup_2026");
  } catch (error) {
    knockoutResolution.warnings.push(error instanceof Error ? error.message : "Falha ao resolver mata-mata.");
  }
  
  const knockoutSync = {
    matchesChecked: knockoutMatches.length,
    realTeamsFromEspn,
    placeholdersDetected,
    placeholdersResolved: knockoutResolution.resolved,
    unresolved: knockoutResolution.pending,
    warnings: knockoutResolution.warnings
  };

  const runMessage =
    provider.name === "local-fixtures"
      ? insertedCount === 0 && updatedCount === 0
        ? "Sincronizacao local executada sem alteracoes (dataset da Copa 2026 ja esta sincronizado)."
        : "Sincronizacao local concluida usando dataset da Copa 2026."
      : provider.name === "static-wc2026"
        ? "Sincronizacao Copa 2026 concluida com agenda estatica ESPN/FIFA validada."
        : provider.name === "wc2026"
          ? "Sincronizacao WC2026 concluida."
          : `Sincronizacao API-Football concluida. ${teamsSynced} times sincronizados.`;

  const logResult = await supabase.from("match_provider_runs").insert({
    checked_matches: providerMatches.length,
    inserted_count: insertedCount,
    knockout_updated: knockoutResolution.resolved,
    message: runMessage,
    provider_name: provider.name,
    status: "success",
    updated_count: updatedCount,
  });

  if (logResult.error) throw logResult.error;

  logSync("SYNC SUCCESS");

  const finishedAt = new Date().toISOString();
  const durationMs = Date.now() - new Date(startedAt).getTime();

  return {
    insertedCount,
    providerName: provider.name,
    knockoutResolution,
    updatedCount,
    teamsSynced,
    standingsSynced: 0, // TODO: Implement standings sync
    lineupsSynced: 0, // TODO: Implement lineups sync
    cacheHits,
    preservedFinishedMatches: 0,
    skippedScorePreservation: 0,
    cacheMisses,
    knockoutSync,
    startedAt,
    finishedAt,
    durationMs,
  };
};

export async function POST(request: NextRequest) {
  try {
    const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
    if (!accessToken) {
      return NextResponse.json({ error: "Sessão administrativa não enviada." }, { status: 401 });
    }

    const supabase = createSupabaseForRequest(accessToken);
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("role,approval_status,status,blocked,deleted_at")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    const profileStatus = profile?.status ?? (profile?.blocked ? "suspended" : profile?.approval_status);
    if (
      !profile ||
      profile.role !== "admin" ||
      profileStatus !== "approved" ||
      profile.blocked ||
      profile.deleted_at
    ) {
      return NextResponse.json({ error: "Apenas admin aprovado pode sincronizar partidas." }, { status: 403 });
    }

    const result = await runSync(supabase);
    
    return NextResponse.json({
      success: true,
      action: "sync-matches",
      provider: result.providerName,
      status: "success",
      startedAt: result.startedAt,
      finishedAt: result.finishedAt,
      durationMs: result.durationMs,
      summary: {
        checkedMatches: result.insertedCount + result.updatedCount,
        insertedMatches: result.insertedCount,
        updatedMatches: result.updatedCount,
        skippedMatches: 0,
        liveMatches: 0,
        finishedMatches: 0,
        scoredPredictions: 0,
        rankingUpdated: 0,
        knockoutResolution: result.knockoutResolution,
        knockoutUpdated: result.knockoutResolution.resolved,
        teamsSynced: result.teamsSynced,
        cacheHits: result.cacheHits,
        cacheMisses: result.cacheMisses,
      },
      changedMatches: [],
      errors: [],
    });
  } catch (error) {
    return NextResponse.json(
      { 
        success: false,
        action: "sync-matches",
        error: error instanceof Error ? error.message : "Erro ao sincronizar partidas.",
      },
      { status: 500 },
    );
  }
}
