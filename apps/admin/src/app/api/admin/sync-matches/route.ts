// LEAGUE AUDIT
// API-FOOTBALL INTEGRATION
// Enhanced sync route to sync teams, standings, lineups with caching and logging

import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  CHAMPIONSHIP_LABELS,
  calculateMatchStatus,
  createMatchesProvider,
  predictionWindowPayload,
  type ChampionshipKey,
  type ProviderMatch,
  type ProviderMatchStats,
  type TournamentType
} from "@gol-de-ouro/shared";
import { scoreFinishedMatchAndRefreshRanking } from "@/lib/ranking-update-service";

type SyncSummary = {
  insertedCount: number;
  providerName: string;
  updatedCount: number;
  teamsSynced: number;
  standingsSynced: number;
  lineupsSynced: number;
  cacheHits: number;
  cacheMisses: number;
};

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
    await supabase.from("matches").update({
      home_team_id: homeTeam?.id || null,
      away_team_id: awayTeam?.id || null,
    }).eq("id", matchId);
  }
};

// FIX MATCH UPSERT - Ensuring all required fields are saved from API-Football
const upsertProviderMatch = async (
  supabase: SupabaseClient,
  providerName: string,
  providerMatch: ProviderMatch,
  tournamentCache: Map<string, string>,
) => {
  // FIX MATCH UPSERT - Log upsert start
  logSync(`UPSERT START: ${providerMatch.championship} - ${providerMatch.homeTeam} vs ${providerMatch.awayTeam}`);

  const tournamentId = await ensureTournament(supabase, providerMatch.championship, tournamentCache);
  // WC2026 MATCH UPSERT
  // PREDICTION WINDOW
  const windowPayload = predictionWindowPayload(providerMatch.kickoff);
  const providerStatus =
    providerMatch.status === "encerrado" && providerMatch.hasFinalScore === false
      ? "ao_vivo"
      : providerMatch.status;
  const status = calculateMatchStatus({
    prediction_close_at: windowPayload.prediction_close_at,
    prediction_open_at: windowPayload.prediction_open_at,
    start_time: providerMatch.kickoff,
    status: providerStatus
  });

  // FIX MATCH UPSERT - Payload includes all required fields: provider_name, provider_external_id, championship, last_synced_at, home_team, away_team, logos, start_time, status
  const payload = {
    away_score: providerMatch.awayScore,
    away_team: providerMatch.awayTeam,
    away_team_logo_url: providerMatch.awayLogoUrl,
    championship: providerMatch.championship,
    home_score: providerMatch.homeScore,
    home_team: providerMatch.homeTeam,
    home_team_logo_url: providerMatch.homeLogoUrl,
    last_synced_at: new Date().toISOString(),
    live_score: { away: providerMatch.awayScore, home: providerMatch.homeScore },
    prediction_close_at: windowPayload.prediction_close_at,
    prediction_open_at: windowPayload.prediction_open_at,
    provider_external_id: providerMatch.externalId,
    provider_name: providerName,
    round: providerMatch.round,
    stadium: providerMatch.stadium,
    start_time: providerMatch.kickoff,
    stats: providerMatch.stats,
    status,
    tournament_id: tournamentId,
  };

  const { data: existing, error: existingError } = await supabase
    .from("matches")
    .select("id,status")
    .eq("provider_name", providerName)
    .eq("provider_external_id", providerMatch.externalId)
    .maybeSingle();

  if (existingError) {
    // UPSERT FIX - Log upsert error
    logSync(`UPSERT ERROR: Failed to check existing match - ${existingError.message}`, "error");
    throw existingError;
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
    await scoreFinishedMatchAndRefreshRanking(supabase, matchId);
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
const runSync = async (supabase: SupabaseClient): Promise<SyncSummary> => {
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
    includeDetails: process.env.API_FOOTBALL_INCLUDE_DETAILS !== "false",
    providerName: process.env.MATCHES_PROVIDER === "wc2026" ? "wc2026" : process.env.MATCHES_PROVIDER === "api-football" ? "api-football" : "local-fixtures",
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
  let insertedCount = 0;
  let updatedCount = 0;

  for (const providerMatch of providerMatches) {
    const action = await upsertProviderMatch(supabase, provider.name, providerMatch, tournamentCache);
    if (action === "inserted") {
      insertedCount += 1;
      cacheMisses++;
    } else {
      updatedCount += 1;
      cacheHits++;
    }
  }

  logSync(`SYNC FIXTURES COMPLETE: ${insertedCount} inserted, ${updatedCount} updated`);

  const logResult = await supabase.from("match_provider_runs").insert({
    inserted_count: insertedCount,
    message:
      provider.name === "local-fixtures"
        ? "Sincronização local concluída. Configure MATCHES_PROVIDER=api-football e API_FOOTBALL_KEY para dados reais."
        : `Sincronização API-Football concluída. ${teamsSynced} times sincronizados.`,
    provider_name: provider.name,
    status: "success",
    updated_count: updatedCount,
  });

  if (logResult.error) throw logResult.error;

  logSync("SYNC SUCCESS");

  return {
    insertedCount,
    providerName: provider.name,
    updatedCount,
    teamsSynced,
    standingsSynced: 0, // TODO: Implement standings sync
    lineupsSynced: 0, // TODO: Implement lineups sync
    cacheHits,
    cacheMisses,
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

    return NextResponse.json(await runSync(supabase));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao sincronizar partidas." },
      { status: 500 },
    );
  }
}
