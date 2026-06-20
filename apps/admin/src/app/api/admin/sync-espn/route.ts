import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { calculateMatchStatus, createEspnProvider, espnStatusToMatchStatus, type EspnMatch, type MatchStatus } from "@gol-de-ouro/shared";
import { scoreFinishedMatchAndRefreshRanking } from "@/lib/ranking-update-service";

type MatchRow = {
  id: string;
  tournament_id: string;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  start_time: string;
  prediction_open_at: string;
  prediction_close_at: string;
  status: MatchStatus;
  championship?: string | null;
  provider_name?: string | null;
  provider_external_id?: string | null;
  stats?: Record<string, unknown> | null;
};

type EspnAppliedUpdate = {
  eventId: string;
  matchId: string;
  score: string;
  status: MatchStatus;
  teams: string;
};

type StandingTeam = {
  drawn: number;
  form: string[];
  goalsAgainst: number;
  goalsFor: number;
  groupCode: string;
  lost: number;
  name: string;
  played: number;
  points: number;
  won: number;
};

const requiredEnv = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`Variavel ${name} nao configurada.`);
  return value;
};

const createSupabaseForRequest = (accessToken: string) =>
  createClient(requiredEnv("NEXT_PUBLIC_SUPABASE_URL"), requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

const normalizeTeam = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase()
    .replace(/^cape verde$/, "cabo verde")
    .replace(/^curacao$/, "curacao")
    .replace(/^iran$/, "ir iran")
    .replace(/^ivory coast$/, "cote d ivoire")
    .replace(/^south korea$/, "korea republic")
    .replace(/^turkiye$/, "turkey")
    .replace(/^united states$/, "usa");

const sameKickoffWindow = (left: string, right: string) => Math.abs(new Date(left).getTime() - new Date(right).getTime()) <= 8 * 60 * 60 * 1000;
const looseKickoffWindow = (left: string, right: string) => Math.abs(new Date(left).getTime() - new Date(right).getTime()) <= 36 * 60 * 60 * 1000;

const canonicalTeam = (value: string) => ({
  "Cape Verde": "Cabo Verde",
  "Curaçao": "Curacao",
  "Iran": "IR Iran",
  "Ivory Coast": "Cote d'Ivoire",
  "South Korea": "Korea Republic",
  "Türkiye": "Turkey",
  "United States": "USA",
}[value] ?? value);

// MATCH ESPN MAPPING
const findMatchForEspnEvent = (matches: MatchRow[], event: EspnMatch) => {
  const byMappedId = matches.find((match) => String(match.stats?.espn_event_id ?? "") === event.eventId);
  if (byMappedId) return byMappedId;

  const espnHome = normalizeTeam(event.home.displayName);
  const espnAway = normalizeTeam(event.away.displayName);
  const exact = matches.find((match) =>
    sameKickoffWindow(match.start_time, event.date)
    && normalizeTeam(match.home_team) === espnHome
    && normalizeTeam(match.away_team) === espnAway,
  );
  if (exact) return exact;

  return matches.find((match) =>
    looseKickoffWindow(match.start_time, event.date)
    && (
      normalizeTeam(match.home_team) === espnHome
      || normalizeTeam(match.away_team) === espnAway
      || normalizeTeam(match.home_team) === espnAway
      || normalizeTeam(match.away_team) === espnHome
    ),
  ) ?? null;
};

const readGroupCode = (match: MatchRow) => {
  const group = match.stats?.group;
  return typeof group === "string" && group ? group : null;
};

const outcome = (homeScore: number, awayScore: number) => {
  if (homeScore > awayScore) return "home";
  if (awayScore > homeScore) return "away";
  return "draw";
};

const ensureStandingTeam = (table: Map<string, StandingTeam>, groupCode: string, name: string) => {
  const key = `${groupCode}:${name}`;
  const existing = table.get(key);
  if (existing) return existing;
  const created: StandingTeam = {
    drawn: 0,
    form: [],
    goalsAgainst: 0,
    goalsFor: 0,
    groupCode,
    lost: 0,
    name,
    played: 0,
    points: 0,
    won: 0,
  };
  table.set(key, created);
  return created;
};

// GROUP STANDINGS UPDATE
const refreshGroupStandings = async (supabase: SupabaseClient, matches: MatchRow[]) => {
  const tournamentId = matches[0]?.tournament_id;
  if (!tournamentId) return 0;

  const table = new Map<string, StandingTeam>();
  for (const match of matches) {
    const groupCode = readGroupCode(match);
    if (!groupCode || match.status !== "encerrado") continue;

    const home = ensureStandingTeam(table, groupCode, match.home_team);
    const away = ensureStandingTeam(table, groupCode, match.away_team);
    const homeScore = Number(match.home_score ?? 0);
    const awayScore = Number(match.away_score ?? 0);
    const result = outcome(homeScore, awayScore);

    home.played += 1;
    away.played += 1;
    home.goalsFor += homeScore;
    home.goalsAgainst += awayScore;
    away.goalsFor += awayScore;
    away.goalsAgainst += homeScore;

    if (result === "home") {
      home.won += 1; home.points += 3; home.form.push("W");
      away.lost += 1; away.form.push("L");
    } else if (result === "away") {
      away.won += 1; away.points += 3; away.form.push("W");
      home.lost += 1; home.form.push("L");
    } else {
      home.drawn += 1; away.drawn += 1; home.points += 1; away.points += 1; home.form.push("D"); away.form.push("D");
    }
  }

  const rows = [...table.values()]
    .sort((left, right) =>
      left.groupCode.localeCompare(right.groupCode)
      || right.points - left.points
      || (right.goalsFor - right.goalsAgainst) - (left.goalsFor - left.goalsAgainst)
      || right.goalsFor - left.goalsFor
      || left.name.localeCompare(right.name),
    )
    .map((team, index, ordered) => {
      const previousInGroup = ordered.slice(0, index).filter((entry) => entry.groupCode === team.groupCode).length;
      return {
        drawn: team.drawn,
        form: team.form.slice(-5).join(""),
        goal_difference: team.goalsFor - team.goalsAgainst,
        goals_against: team.goalsAgainst,
        goals_for: team.goalsFor,
        group_code: team.groupCode,
        lost: team.lost,
        played: team.played,
        points: team.points,
        position: previousInGroup + 1,
        team_name: team.name,
        tournament_id: tournamentId,
        won: team.won,
      };
    });

  if (!rows.length) return 0;
  const { error } = await supabase.from("standings").upsert(rows, { onConflict: "tournament_id,team_name" });
  if (error) throw error;
  return rows.length;
};

const selectGroupTeam = (standings: StandingTeam[], token: string) => {
  const winnerMatch = token.match(/Winner Group ([A-L])/i);
  const runnerMatch = token.match(/Runner-up Group ([A-L])/i);
  const thirdMatch = token.match(/Third Place Group ([A-L/]+)/i);
  if (winnerMatch) return standings.find((team) => team.groupCode === winnerMatch[1] && team.played >= 3)?.name ?? token;
  if (runnerMatch) return standings.filter((team) => team.groupCode === runnerMatch[1] && team.played >= 3)[1]?.name ?? token;
  if (thirdMatch) {
    const allowed = new Set(thirdMatch[1].split("/"));
    return standings.filter((team) => allowed.has(team.groupCode) && team.played >= 3)[2]?.name ?? token;
  }
  return token;
};

// KNOCKOUT UPDATE
const updateKnockoutPlaceholders = async (supabase: SupabaseClient, matches: MatchRow[]) => {
  const finalGroupMatches = matches.filter((match) => readGroupCode(match) && match.status === "encerrado");
  if (finalGroupMatches.length < 72) return 0;

  const table = new Map<string, StandingTeam>();
  for (const match of finalGroupMatches) {
    const groupCode = readGroupCode(match);
    if (!groupCode) continue;
    ensureStandingTeam(table, groupCode, match.home_team).played += 0;
    ensureStandingTeam(table, groupCode, match.away_team).played += 0;
  }

  await refreshGroupStandings(supabase, matches);
  const { data } = await supabase
    .from("standings")
    .select("team_name,group_code,played,points,goals_for,goals_against,position")
    .eq("tournament_id", matches[0].tournament_id)
    .not("group_code", "is", null);

  const ordered = (data ?? []).map((row) => ({
    drawn: 0,
    form: [],
    goalsAgainst: Number(row.goals_against ?? 0),
    goalsFor: Number(row.goals_for ?? 0),
    groupCode: String(row.group_code),
    lost: 0,
    name: String(row.team_name),
    played: Number(row.played ?? 0),
    points: Number(row.points ?? 0),
    won: 0,
  })).sort((left, right) => left.groupCode.localeCompare(right.groupCode) || right.points - left.points || (right.goalsFor - right.goalsAgainst) - (left.goalsFor - left.goalsAgainst));

  let updated = 0;
  for (const match of matches) {
    if (!match.home_team.includes("Group") && !match.away_team.includes("Group")) continue;
    const homeTeam = selectGroupTeam(ordered, match.home_team);
    const awayTeam = selectGroupTeam(ordered, match.away_team);
    if (homeTeam === match.home_team && awayTeam === match.away_team) continue;
    const { error } = await supabase.from("matches").update({ home_team: homeTeam, away_team: awayTeam }).eq("id", match.id);
    if (error) throw error;
    updated += 1;
  }
  return updated;
};

// RESULT SYNC + AUTO MATCH FINALIZATION
const applyEspnResult = async (supabase: SupabaseClient, match: MatchRow, event: EspnMatch) => {
  const localStatus = calculateMatchStatus(match);
  const status = espnStatusToMatchStatus(event.status, localStatus);
  const stats = { ...(match.stats ?? {}), espn_event_id: event.eventId, espn_status: event.rawStatusName, espn_status_detail: event.statusDetail };
  const payload = {
    away_score: event.away.score,
    away_team: canonicalTeam(event.away.displayName),
    away_team_logo_url: event.away.logo,
    home_score: event.home.score,
    home_team: canonicalTeam(event.home.displayName),
    home_team_logo_url: event.home.logo,
    last_synced_at: new Date().toISOString(),
    start_time: event.date,
    live_score: { away: event.away.score, home: event.home.score },
    stadium: event.venue ?? undefined,
    stats,
    status,
  };

  const { error } = await supabase.from("matches").update(payload).eq("id", match.id);
  if (error) throw error;

  if (status === "encerrado" && match.status !== "encerrado") {
    await scoreFinishedMatchAndRefreshRanking(supabase, match.id);
  }

  return {
    eventId: event.eventId,
    matchId: match.id,
    score: `${event.home.score}x${event.away.score}`,
    status,
    teams: `${match.home_team} x ${match.away_team}`,
  };
};

const runEspnSync = async (supabase: SupabaseClient) => {
  const provider = createEspnProvider({ baseUrl: process.env.ESPN_SCOREBOARD_BASE_URL });
  const today = process.env.ESPN_SCOREBOARD_DATE ? new Date(`${process.env.ESPN_SCOREBOARD_DATE}T00:00:00Z`) : new Date();
  const events = await provider.fetchScoreboard(today);

  const { data: matches, error } = await supabase
    .from("matches")
    .select("*")
    .eq("championship", "world_cup_2026")
    .is("deleted_at", null)
    .order("start_time", { ascending: true });
  if (error) throw error;

  const updates: EspnAppliedUpdate[] = [];
  const skipped = [];
  for (const event of events) {
    const match = findMatchForEspnEvent((matches ?? []) as MatchRow[], event);
    if (!match) {
      skipped.push({ eventId: event.eventId, name: `${event.home.displayName} x ${event.away.displayName}` });
      continue;
    }
    updates.push(await applyEspnResult(supabase, match, event));
  }

  const refreshedMatches = ((matches ?? []) as MatchRow[]).map((match) => {
    const update = updates.find((item) => item.matchId === match.id);
    if (!update) return match;
    const [homeScore, awayScore] = update.score.split("x").map(Number);
    return { ...match, home_score: homeScore, away_score: awayScore, status: update.status };
  });

  const standingsSynced = await refreshGroupStandings(supabase, refreshedMatches);
  const knockoutUpdated = await updateKnockoutPlaceholders(supabase, refreshedMatches);
  const summary = {
    date: today.toISOString().slice(0, 10),
    events: events.length,
    finished: updates.filter((update) => update.status === "encerrado").length,
    live: updates.filter((update) => update.status === "ao_vivo").length,
    knockoutUpdated,
    provider: provider.name,
    skipped,
    standingsSynced,
    updated: updates,
    updatedCount: updates.length,
  };

  await supabase.from("match_provider_runs").insert({
    inserted_count: 0,
    message: `ESPN sync: ${summary.updatedCount} jogos atualizados, ${summary.finished} encerrados, ${summary.live} ao vivo.`,
    provider_name: "espn",
    status: "success",
    updated_count: summary.updatedCount,
  });

  return summary;
};

export async function POST(request: NextRequest) {
  try {
    const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
    if (!accessToken) return NextResponse.json({ error: "Sessao administrativa nao enviada." }, { status: 401 });

    const supabase = createSupabaseForRequest(accessToken);
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return NextResponse.json({ error: "Sessao invalida." }, { status: 401 });

    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("role,approval_status,status,blocked,deleted_at")
      .eq("id", authData.user.id)
      .maybeSingle();
    if (profileError) throw profileError;

    const profileStatus = profile?.status ?? (profile?.blocked ? "suspended" : profile?.approval_status);
    if (!profile || profile.role !== "admin" || profileStatus !== "approved" || profile.blocked || profile.deleted_at) {
      return NextResponse.json({ error: "Apenas admin aprovado pode sincronizar resultados." }, { status: 403 });
    }

    return NextResponse.json(await runEspnSync(supabase));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao sincronizar ESPN." },
      { status: 500 },
    );
  }
}
