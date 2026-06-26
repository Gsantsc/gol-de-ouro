import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  calculateMatchStatus,
  calculatePredictionPoints,
  createEspnProvider,
  espnStatusToMatchStatus,
  isMatchFinishedForScoring,
  predictionWindowPayload,
  type EspnMatch,
  type MatchStatus,
  type PredictionWinner
} from "@gol-de-ouro/shared";
import { formatSyncErrorForDisplay } from "../lib/sync-error-format";

type JsonRecord = Record<string, unknown>;

type MatchRow = {
  id: string;
  tournament_id: string;
  home_team: string;
  away_team: string;
  home_team_logo_url?: string | null;
  away_team_logo_url?: string | null;
  home_score: number;
  away_score: number;
  first_goal_scorer?: string | null;
  first_goal_scorer_id?: string | null;
  first_goal_no_goals?: boolean | null;
  man_of_match?: string | null;
  man_of_match_id?: string | null;
  red_card_happened?: boolean | null;
  red_cards_home?: number | null;
  red_cards_away?: number | null;
  start_time: string;
  prediction_open_at?: string | null;
  prediction_close_at?: string | null;
  status: MatchStatus;
  championship?: string | null;
  stadium?: string | null;
  round?: string | null;
  provider_name?: string | null;
  provider_external_id?: string | null;
  live_score?: { away: number; home: number } | null;
  stats?: JsonRecord | null;
  deleted_at?: string | null;
};

type PredictionRow = {
  id: string;
  user_id: string;
  match_id: string;
  predicted_home_score: number;
  predicted_away_score: number;
  predicted_winner?: PredictionWinner | null;
  predicted_first_scorer?: string | null;
  predicted_first_scorer_id?: string | null;
  predicted_first_goal_no_goals?: boolean | null;
  predicted_both_teams_score?: boolean | null;
  predicted_man_of_match?: string | null;
  predicted_man_of_match_id?: string | null;
  predicted_red_card?: boolean | null;
  locked?: boolean;
  points: number;
};

type UserRow = {
  id: string;
  status?: string | null;
  approval_status?: string | null;
  blocked?: boolean | null;
  deleted_at?: string | null;
};

type RankingRow = {
  user_id: string;
  total_points: number;
  correct_results: number;
  exact_scores: number;
};

type CompetitionRankingRow = RankingRow & {
  championship: string;
};

type StandingDraft = {
  drawn: number;
  form: string[];
  goal_difference: number;
  goals_against: number;
  goals_for: number;
  group_code: string;
  lost: number;
  played: number;
  points: number;
  position: number;
  team_name: string;
  tournament_id: string;
  won: number;
};

type StandingRow = Omit<StandingDraft, "form"> & {
  form: string | null;
};

export type RunLiveResultsSyncOptions = {
  dryRun?: boolean;
  force?: boolean;
  now?: Date;
  provider?: "espn" | "none";
  supabase: SupabaseClient;
  triggeredBy: "admin" | "cron" | string;
};

export type LiveResultsSyncSummary = {
  checkedMatches: number;
  dryRun: boolean;
  errors: string[];
  finishedAt: string;
  finishedMatches: number;
  knockoutUpdated: number;
  liveMatches: number;
  provider: string;
  rankingUpdated: number;
  scoredPredictions: number;
  startedAt: string;
  standingsUpdated: number;
  status: "success" | "partial_success" | "failed";
  triggeredBy: string;
  updatedMatches: number;
};

// SYNC STATUS CLASSIFICATION - Classify sync status based on errors and updates
const classifySyncStatus = (errors: string[], updatedMatches: number, checkedMatches: number): "success" | "partial_success" | "failed" => {
  if (errors.length === 0) return "success";
  // If there were updates despite errors, it's partial success, not total failure
  if (updatedMatches > 0 || checkedMatches > 0) return "partial_success";
  return "failed";
};

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const requiredEnv = (names: string[]) => {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  throw new Error(`Configure ${names.join(" ou ")} no ambiente do Admin.`);
};

export const createServiceSupabaseClient = () =>
  createClient(
    requiredEnv(["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"]),
    requiredEnv(["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY"]),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

const readStats = (match: Pick<MatchRow, "stats">): JsonRecord => {
  if (!match.stats || typeof match.stats !== "object") return {};
  return match.stats;
};

const readNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const readString = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);

// SYNC ERROR SERIALIZATION - Robust error serialization to avoid [object Object]
const serializeSyncError = (error: unknown): string => {
  if (error && typeof error === "object" && "code" in error) {
    const record = error as { code?: unknown; message?: unknown };
    if (String(record.code) === "21000") {
      return formatSyncErrorForDisplay({
        code: "21000",
        message: typeof record.message === "string" ? record.message : undefined,
      });
    }
  }

  if (error instanceof Error) {
    const formatted = formatSyncErrorForDisplay(error.message);
    const stack = process.env.NODE_ENV === "development" && error.stack
      ? ` (${error.stack.split("\n")[0]})`
      : "";
    return `${formatted}${stack}`;
  }

  return formatSyncErrorForDisplay(error);
};

const dedupeByKey = <T,>(
  rows: T[],
  getKey: (row: T) => string,
  pickPreferred: (current: T, candidate: T) => T = (_current, candidate) => candidate,
) => {
  const map = new Map<string, T>();

  for (const row of rows) {
    const key = getKey(row);
    const existing = map.get(key);
    map.set(key, existing ? pickPreferred(existing, row) : row);
  }

  return [...map.values()];
};

const logDedupedPayload = (
  label: "competition_rankings" | "standings" | "rankings",
  before: number,
  after: number,
) => {
  if (before === after) return;

  console.warn(`[sync-results] ${label} payload deduplicated`, {
    after,
    before,
    removed: before - after,
  });
};

const normalizeTeam = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase()
    .replace(/^south korea$/, "korea republic")
    .replace(/^usa$/, "united states")
    .replace(/^united states of america$/, "united states");

const sameKickoffWindow = (left: string, right: string, hours: number) =>
  Math.abs(new Date(left).getTime() - new Date(right).getTime()) <= hours * HOUR_MS;

const findMatchForEspnEvent = (matches: MatchRow[], event: EspnMatch) => {
  const byMappedId = matches.find((match) => String(readStats(match).espn_event_id ?? "") === event.eventId);
  if (byMappedId) return byMappedId;

  const espnHome = normalizeTeam(event.home.displayName);
  const espnAway = normalizeTeam(event.away.displayName);
  const exact = matches.find((match) =>
    sameKickoffWindow(match.start_time, event.date, 8)
    && normalizeTeam(match.home_team) === espnHome
    && normalizeTeam(match.away_team) === espnAway,
  );
  if (exact) return exact;

  return matches.find((match) =>
    sameKickoffWindow(match.start_time, event.date, 36)
    && (
      normalizeTeam(match.home_team) === espnHome
      || normalizeTeam(match.away_team) === espnAway
      || normalizeTeam(match.home_team) === espnAway
      || normalizeTeam(match.away_team) === espnHome
    ),
  ) ?? null;
};

const listMatches = async (supabase: SupabaseClient) => {
  const { data, error } = await supabase
    .from("matches")
    .select("*")
    .is("deleted_at", null)
    .order("start_time", { ascending: true });

  if (error) throw error;
  return (data ?? []) as MatchRow[];
};

const listPredictions = async (supabase: SupabaseClient) => {
  const { data, error } = await supabase.from("predictions").select("*");
  if (error) throw error;
  return (data ?? []) as PredictionRow[];
};

const groupPredictionsByMatch = (predictions: PredictionRow[]) => {
  const grouped = new Map<string, PredictionRow[]>();
  for (const prediction of predictions) {
    if (!grouped.has(prediction.match_id)) grouped.set(prediction.match_id, []);
    grouped.get(prediction.match_id)?.push(prediction);
  }
  return grouped;
};
const predictionPointsFor = (match: MatchRow, prediction: PredictionRow) => {
  const homeScore = Number(match.home_score ?? 0);
  const awayScore = Number(match.away_score ?? 0);
  const isNoGoalMatch = homeScore === 0 && awayScore === 0;

  const redCardCount = Number(match.red_cards_home ?? 0) + Number(match.red_cards_away ?? 0);

  const officialRedCard =
    redCardCount > 0
      ? true
      : match.red_card_happened !== null && match.red_card_happened !== undefined
        ? match.red_card_happened
        : undefined;

  return calculatePredictionPoints(
    {
      awayScore,
      firstGoalNoGoals: isNoGoalMatch ? true : false,
      firstScorer: isNoGoalMatch ? null : match.first_goal_scorer,
      firstScorerId: isNoGoalMatch ? null : match.first_goal_scorer_id,
      homeScore,
      manOfMatch: match.man_of_match,
      manOfMatchId: match.man_of_match_id,
      redCard: officialRedCard,
    },
    {
      awayScore: Number(prediction.predicted_away_score ?? 0),
      bothTeamsScore: prediction.predicted_both_teams_score,
      firstGoalNoGoals: prediction.predicted_first_goal_no_goals,
      firstScorer: prediction.predicted_first_scorer,
      firstScorerId: prediction.predicted_first_scorer_id,
      homeScore: Number(prediction.predicted_home_score ?? 0),
      manOfMatch: prediction.predicted_man_of_match,
      manOfMatchId: prediction.predicted_man_of_match_id,
      redCard: prediction.predicted_red_card,
      winner: prediction.predicted_winner,
    },
  );
};

const outcomeForScore = (homeScore: number, awayScore: number): PredictionWinner => {
  if (homeScore > awayScore) return "home";
  if (awayScore > homeScore) return "away";
  return "draw";
};

const predictionOutcomeFor = (prediction: PredictionRow): PredictionWinner => {
  if (prediction.predicted_winner) return prediction.predicted_winner;

  return outcomeForScore(
    Number(prediction.predicted_home_score ?? 0),
    Number(prediction.predicted_away_score ?? 0),
  );
};

const hasUnscoredPrediction = (match: MatchRow, predictionsByMatch: Map<string, PredictionRow[]>) => {
  if (!isMatchFinishedForScoring(match)) return false;
  return (predictionsByMatch.get(match.id) ?? []).some(
    (prediction) => Number(prediction.points ?? 0) !== predictionPointsFor(match, prediction),
  );
};

const isInSyncScope = (
  match: MatchRow,
  predictionsByMatch: Map<string, PredictionRow[]>,
  now: Date,
  force: boolean,
) => {
  if (force) return true;
  const startAt = new Date(match.start_time);
  if (Number.isNaN(startAt.getTime())) return false;

  const todayKey = now.toISOString().slice(0, 10);
  const matchDayKey = startAt.toISOString().slice(0, 10);
  const startsSoon = startAt.getTime() >= now.getTime() - HOUR_MS && startAt.getTime() <= now.getTime() + 3 * HOUR_MS;
  const recentlyFinished = match.status === "encerrado" && startAt.getTime() >= now.getTime() - DAY_MS;
  const staleLive = match.status === "ao_vivo";

  return matchDayKey === todayKey
    || startsSoon
    || recentlyFinished
    || staleLive
    || hasUnscoredPrediction(match, predictionsByMatch);
};

const datesForProvider = (matches: MatchRow[], now: Date) => {
  const overrideDate = process.env.ESPN_SCOREBOARD_DATE;
  if (overrideDate) return [new Date(`${overrideDate.slice(0, 4)}-${overrideDate.slice(4, 6)}-${overrideDate.slice(6, 8)}T12:00:00Z`)];

  const keys = new Set<string>([now.toISOString().slice(0, 10)]);
  for (const match of matches) {
    const date = new Date(match.start_time);
    if (!Number.isNaN(date.getTime())) keys.add(date.toISOString().slice(0, 10));
  }

  return [...keys].sort().map((key) => new Date(`${key}T12:00:00Z`));
};

const patchMatch = async (
  supabase: SupabaseClient,
  match: MatchRow,
  payload: Partial<MatchRow>,
  dryRun: boolean,
) => {
  Object.assign(match, payload);
  if (dryRun) return;

  const { error } = await supabase.from("matches").update(payload).eq("id", match.id);
  if (error) throw error;
};

// SYNC SCOPE OPTIMIZATION
const updateLocalStatusWindows = async (
  supabase: SupabaseClient,
  matches: MatchRow[],
  now: Date,
  dryRun: boolean,
  predictionLockMinutes: number,
) => {
  let updated = 0;

  for (const match of matches) {
    if (match.status === "encerrado") continue;
    
    const windowPayload = predictionWindowPayload(match.start_time, predictionLockMinutes);
    const nextStatus = calculateMatchStatus(
      {
        ...match,
        prediction_close_at: windowPayload.prediction_close_at,
        prediction_open_at: windowPayload.prediction_open_at,
      },
      now,
    );
    
    const needsUpdate =
      match.prediction_open_at !== windowPayload.prediction_open_at
      || match.prediction_close_at !== windowPayload.prediction_close_at;

    if (!needsUpdate) continue;
    
    await patchMatch(supabase, match, { ...windowPayload }, dryRun);
    updated += 1;
  }

  return updated;
};

const applyEspnEvent = async (
  supabase: SupabaseClient,
  match: MatchRow,
  event: EspnMatch,
  now: Date,
  dryRun: boolean,
  predictionLockMinutes: number,
) => {
  const windowPayload = predictionWindowPayload(match.start_time, predictionLockMinutes);
  const localStatus = calculateMatchStatus(
    {
      ...match,
      prediction_close_at: windowPayload.prediction_close_at,
      prediction_open_at: windowPayload.prediction_open_at,
    },
    now,
  );
  const status = espnStatusToMatchStatus(event.status, localStatus);
  const hasProviderScore = event.status === "in" || event.status === "final";
  const stats = {
    ...readStats(match),
    espn_event_id: event.eventId,
    espn_status: event.rawStatusName ?? event.status,
    espn_status_detail: event.statusDetail ?? null,
  };
  const payload: Partial<MatchRow> = {
    ...windowPayload,
    last_synced_at: new Date().toISOString(),
    stats,
    status,
  } as Partial<MatchRow>;

  if (hasProviderScore) {
    Object.assign(payload, {
      away_score: event.away.score,
      away_team: event.away.displayName,
      away_team_logo_url: event.away.logo,
      home_score: event.home.score,
      home_team: event.home.displayName,
      home_team_logo_url: event.home.logo,
      live_score: { away: event.away.score, home: event.home.score },
      start_time: event.date,
    });
  }

  if (event.venue) payload.stadium = event.venue;

  await patchMatch(supabase, match, payload, dryRun);

  return {
    finished: status === "encerrado",
    live: status === "ao_vivo",
  };
};

const readPredictionLockMinutes = async (supabase: SupabaseClient) => {
  const { data, error } = await supabase.rpc("get_app_settings");
  if (error) return 60;
  const value = Number(data?.[0]?.prediction_lock_minutes ?? 60);
  return [60, 90, 120, 180].includes(value) ? value : 60;
};

const fetchProviderEvents = async (matches: MatchRow[], now: Date, providerName: string, errors: string[]) => {
  if (providerName !== "espn") return [];

  const provider = createEspnProvider({ baseUrl: process.env.ESPN_SCOREBOARD_BASE_URL });
  const events: EspnMatch[] = [];

  for (const date of datesForProvider(matches, now)) {
    try {
      events.push(...await provider.fetchScoreboard(date));
    } catch (error) {
      errors.push(serializeSyncError(error));
    }
  }

  const unique = new Map<string, EspnMatch>();
  for (const event of events) unique.set(event.eventId, event);
  return [...unique.values()];
};

// SYNC IDEMPOTENCY
const scoreFinishedMatches = async (
  supabase: SupabaseClient,
  matches: MatchRow[],
  predictionsByMatch: Map<string, PredictionRow[]>,
  dryRun: boolean,
) => {
  let scoredPredictions = 0;

  for (const match of matches) {
    if (!isMatchFinishedForScoring(match)) continue;

    for (const prediction of predictionsByMatch.get(match.id) ?? []) {
      const points = predictionPointsFor(match, prediction);
      const needsUpdate = Number(prediction.points ?? 0) !== points || prediction.locked !== true;
      if (!needsUpdate) continue;

      scoredPredictions += 1;
      prediction.points = points;
      prediction.locked = true;

      if (!dryRun) {
        const { error } = await supabase
          .from("predictions")
          .update({ locked: true, points })
          .eq("id", prediction.id);
        if (error) throw error;
      }
    }
  }

  return scoredPredictions;
};

const refreshRankings = async (
  supabase: SupabaseClient,
  predictions: PredictionRow[],
  matches: MatchRow[],
  dryRun: boolean,
) => {
  const [
    { data: usersData, error: usersError },
    { data: rankingsData, error: rankingsError },
    { data: competitionRankingsData, error: competitionRankingsError },
  ] = await Promise.all([
    supabase.from("users").select("id,status,approval_status,blocked,deleted_at").is("deleted_at", null),
    supabase.from("rankings").select("user_id,total_points,correct_results,exact_scores"),
    supabase
      .from("competition_rankings")
      .select("championship,user_id,total_points,correct_results,exact_scores"),
  ]);
  if (usersError) throw usersError;
  if (rankingsError) throw rankingsError;
  if (competitionRankingsError) throw competitionRankingsError;

  const users = (usersData ?? []) as UserRow[];
  const rankings = (rankingsData ?? []) as RankingRow[];
  const competitionRankings = (competitionRankingsData ?? []) as CompetitionRankingRow[];
  const matchById = new Map(matches.map((match) => [match.id, match]));
  const rankingByUser = new Map(rankings.map((ranking) => [ranking.user_id, ranking]));
  const competitionRankingByKey = new Map(
    competitionRankings.map((ranking) => [`${ranking.championship}:${ranking.user_id}`, ranking]),
  );
  const predictionsByUser = new Map<string, PredictionRow[]>();

  for (const prediction of predictions) {
    if (!predictionsByUser.has(prediction.user_id)) predictionsByUser.set(prediction.user_id, []);
    predictionsByUser.get(prediction.user_id)?.push(prediction);
  }

  const changed = [];
  const competitionChanged: Array<CompetitionRankingRow & { updated_at: string }> = [];
  for (const user of users) {
    const status = user.status ?? (user.blocked ? "suspended" : user.approval_status);
    if (status !== "approved" || user.blocked) continue;

    const userPredictions = predictionsByUser.get(user.id) ?? [];
    const totalPoints = userPredictions.reduce((sum, prediction) => sum + Number(prediction.points ?? 0), 0);
    const correctResults = userPredictions.filter((prediction) => {
      const match = matchById.get(prediction.match_id);
      if (!match || match.status !== "encerrado") return false;

      const officialOutcome = outcomeForScore(
        Number(match.home_score ?? 0),
        Number(match.away_score ?? 0),
      );
      return predictionOutcomeFor(prediction) === officialOutcome;
    }).length;
    const exactScores = userPredictions.filter((prediction) => {
      const match = matchById.get(prediction.match_id);
      return Boolean(
        match
        && match.status === "encerrado"
        && Number(prediction.predicted_home_score) === Number(match.home_score)
        && Number(prediction.predicted_away_score) === Number(match.away_score),
      );
    }).length;
    const competitionStats = new Map<string, CompetitionRankingRow & { updated_at: string }>();

    for (const prediction of userPredictions) {
      const match = matchById.get(prediction.match_id);
      if (!match || !match.championship || !isMatchFinishedForScoring(match)) continue;

      const key = `${match.championship}:${prediction.user_id}`;
      const currentCompetitionRanking =
        competitionStats.get(key) ?? {
          championship: match.championship,
          correct_results: 0,
          exact_scores: 0,
          total_points: 0,
          updated_at: new Date().toISOString(),
          user_id: prediction.user_id,
        };
      const officialOutcome = outcomeForScore(
        Number(match.home_score ?? 0),
        Number(match.away_score ?? 0),
      );

      currentCompetitionRanking.total_points += Number(prediction.points ?? 0);
      if (predictionOutcomeFor(prediction) === officialOutcome) {
        currentCompetitionRanking.correct_results += 1;
      }
      if (
        Number(prediction.predicted_home_score) === Number(match.home_score)
        && Number(prediction.predicted_away_score) === Number(match.away_score)
      ) {
        currentCompetitionRanking.exact_scores += 1;
      }

      competitionStats.set(key, currentCompetitionRanking);
    }

    for (const [key, competitionRanking] of competitionStats) {
      const currentCompetitionRanking = competitionRankingByKey.get(key);

      if (
        currentCompetitionRanking
        && Number(currentCompetitionRanking.total_points ?? 0) === competitionRanking.total_points
        && Number(currentCompetitionRanking.correct_results ?? 0) === competitionRanking.correct_results
        && Number(currentCompetitionRanking.exact_scores ?? 0) === competitionRanking.exact_scores
      ) {
        continue;
      }

      competitionChanged.push(competitionRanking);
    }

    const current = rankingByUser.get(user.id);

    if (
      current
      && Number(current.total_points ?? 0) === totalPoints
      && Number(current.correct_results ?? 0) === correctResults
      && Number(current.exact_scores ?? 0) === exactScores
    ) {
      continue;
    }

    changed.push({
      correct_results: correctResults,
      exact_scores: exactScores,
      total_points: totalPoints,
      updated_at: new Date().toISOString(),
      user_id: user.id,
    });
  }

  if (changed.length && !dryRun) {
    const rankingPayload = dedupeByKey(changed, (row) => row.user_id);
    logDedupedPayload("rankings", changed.length, rankingPayload.length);

    const { error } = await supabase
      .from("rankings")
      .upsert(rankingPayload, { onConflict: "user_id" });
    if (error) throw error;
  }

  if (competitionChanged.length && !dryRun) {
    const competitionRankingPayload = dedupeByKey(
      competitionChanged,
      (row) => `${row.championship}:${row.user_id}`,
    );
    logDedupedPayload("competition_rankings", competitionChanged.length, competitionRankingPayload.length);

    const { error } = await supabase
      .from("competition_rankings")
      .upsert(competitionRankingPayload, { onConflict: "championship,user_id" });
    if (error) throw error;
  }

  return changed.length;
};

const readGroupCode = (match: MatchRow) => readString(readStats(match).group);

const outcome = (homeScore: number, awayScore: number) => {
  if (homeScore > awayScore) return "home";
  if (awayScore > homeScore) return "away";
  return "draw";
};

const ensureStanding = (table: Map<string, StandingDraft>, tournamentId: string, groupCode: string, teamName: string) => {
  const key = `${tournamentId}:${groupCode}:${teamName}`;
  const existing = table.get(key);
  if (existing) return existing;

  const created: StandingDraft = {
    drawn: 0,
    form: [],
    goal_difference: 0,
    goals_against: 0,
    goals_for: 0,
    group_code: groupCode,
    lost: 0,
    played: 0,
    points: 0,
    position: 0,
    team_name: teamName,
    tournament_id: tournamentId,
    won: 0,
  };
  table.set(key, created);
  return created;
};

const buildGroupStandings = (matches: MatchRow[]) => {
  const table = new Map<string, StandingDraft>();

  for (const match of matches) {
    const groupCode = readGroupCode(match);
    if (!groupCode || match.status !== "encerrado") continue;

    const home = ensureStanding(table, match.tournament_id, groupCode, match.home_team);
    const away = ensureStanding(table, match.tournament_id, groupCode, match.away_team);
    const homeScore = Number(match.home_score ?? 0);
    const awayScore = Number(match.away_score ?? 0);
    const result = outcome(homeScore, awayScore);

    home.played += 1;
    away.played += 1;
    home.goals_for += homeScore;
    home.goals_against += awayScore;
    away.goals_for += awayScore;
    away.goals_against += homeScore;

    if (result === "home") {
      home.won += 1;
      home.points += 3;
      home.form.push("W");
      away.lost += 1;
      away.form.push("L");
    } else if (result === "away") {
      away.won += 1;
      away.points += 3;
      away.form.push("W");
      home.lost += 1;
      home.form.push("L");
    } else {
      home.drawn += 1;
      away.drawn += 1;
      home.points += 1;
      away.points += 1;
      home.form.push("D");
      away.form.push("D");
    }
  }

  return [...table.values()]
    .map((team) => ({
      ...team,
      goal_difference: team.goals_for - team.goals_against,
    }))
    .sort((left, right) =>
      left.tournament_id.localeCompare(right.tournament_id)
      || left.group_code.localeCompare(right.group_code)
      || right.points - left.points
      || right.goal_difference - left.goal_difference
      || right.goals_for - left.goals_for
      || left.team_name.localeCompare(right.team_name),
    )
    .map((team, index, ordered) => ({
      ...team,
      position: ordered.slice(0, index).filter(
        (entry) => entry.tournament_id === team.tournament_id && entry.group_code === team.group_code,
      ).length + 1,
    }));
};

const refreshGroupStandings = async (supabase: SupabaseClient, matches: MatchRow[], dryRun: boolean) => {
  const standings = buildGroupStandings(matches);
  if (!standings.length) return { changed: 0, standings };

  const tournamentIds = [...new Set(standings.map((standing) => standing.tournament_id))];
  const { data, error } = await supabase
    .from("standings")
    .select("tournament_id,team_name,position,played,won,drawn,lost,goals_for,goals_against,goal_difference,points,form,group_code")
    .in("tournament_id", tournamentIds);
  if (error) throw error;

  const existing = new Map(
    ((data ?? []) as StandingRow[]).map((standing) => [`${standing.tournament_id}:${standing.team_name}`, standing]),
  );
  const changed = standings.filter((standing) => {
    const current = existing.get(`${standing.tournament_id}:${standing.team_name}`);
    const form = standing.form.slice(-5).join("");
    return !current
      || current.group_code !== standing.group_code
      || Number(current.position ?? 0) !== standing.position
      || Number(current.played ?? 0) !== standing.played
      || Number(current.won ?? 0) !== standing.won
      || Number(current.drawn ?? 0) !== standing.drawn
      || Number(current.lost ?? 0) !== standing.lost
      || Number(current.goals_for ?? 0) !== standing.goals_for
      || Number(current.goals_against ?? 0) !== standing.goals_against
      || Number(current.goal_difference ?? 0) !== standing.goal_difference
      || Number(current.points ?? 0) !== standing.points
      || (current.form ?? "") !== form;
  });

  if (changed.length && !dryRun) {
    const payloadByConflictKey = new Map<string, StandingRow>();

    for (const standing of changed) {
      const key = `${standing.tournament_id}:${standing.team_name}`;
      payloadByConflictKey.set(key, {
        drawn: standing.drawn,
        form: standing.form.slice(-5).join(""),
        goal_difference: standing.goal_difference,
        goals_against: standing.goals_against,
        goals_for: standing.goals_for,
        group_code: standing.group_code,
        lost: standing.lost,
        played: standing.played,
        points: standing.points,
        position: standing.position,
        team_name: standing.team_name,
        tournament_id: standing.tournament_id,
        won: standing.won,
      });
    }

    const payload = [...payloadByConflictKey.values()];
    logDedupedPayload("standings", changed.length, payload.length);

    const { error: upsertError } = await supabase
      .from("standings")
      .upsert(payload, { onConflict: "tournament_id,team_name" });
    if (upsertError) throw upsertError;
  }

  return { changed: changed.length, standings };
};

const matchNumberOf = (match: MatchRow) => readNumber(readStats(match).match_number);

const resolveWinnerLoser = (match: MatchRow, kind: "winner" | "loser") => {
  const homeScore = Number(match.home_score ?? 0);
  const awayScore = Number(match.away_score ?? 0);
  if (match.status !== "encerrado" || homeScore === awayScore) return null;
  if (kind === "winner") return homeScore > awayScore ? match.home_team : match.away_team;
  return homeScore > awayScore ? match.away_team : match.home_team;
};

const selectQualifiedGroupTeam = (
  token: string,
  standings: StandingDraft[],
  usedThirdPlaceTeams: Set<string>,
) => {
  const winner = token.match(/^Winner Group ([A-L])$/i);
  if (winner) {
    return standings.find((standing) => standing.group_code === winner[1] && standing.position === 1 && standing.played >= 3)?.team_name ?? null;
  }

  const runner = token.match(/^Runner-up Group ([A-L])$/i);
  if (runner) {
    return standings.find((standing) => standing.group_code === runner[1] && standing.position === 2 && standing.played >= 3)?.team_name ?? null;
  }

  const third = token.match(/^Third Place Group ([A-L/]+)$/i);
  if (!third) return null;

  const allowedGroups = new Set(third[1].split("/"));
  const thirdPlaceRanking = standings
    .filter((standing) => standing.position === 3 && standing.played >= 3)
    .sort((left, right) =>
      right.points - left.points
      || right.goal_difference - left.goal_difference
      || right.goals_for - left.goals_for
      || left.team_name.localeCompare(right.team_name),
    );

  const selected = thirdPlaceRanking.find(
    (standing) => allowedGroups.has(standing.group_code) && !usedThirdPlaceTeams.has(standing.team_name),
  );
  if (!selected) return null;

  usedThirdPlaceTeams.add(selected.team_name);
  return selected.team_name;
};

const resolvePlaceholder = (
  value: string,
  matchesByNumber: Map<number, MatchRow>,
  standings: StandingDraft[],
  usedThirdPlaceTeams: Set<string>,
) => {
  const groupTeam = selectQualifiedGroupTeam(value, standings, usedThirdPlaceTeams);
  if (groupTeam) return groupTeam;

  const winner = value.match(/^Winner Match (\d+)$/i);
  if (winner) {
    const source = matchesByNumber.get(Number(winner[1]));
    return source ? resolveWinnerLoser(source, "winner") : null;
  }

  const loser = value.match(/^Loser Match (\d+)$/i);
  if (loser) {
    const source = matchesByNumber.get(Number(loser[1]));
    return source ? resolveWinnerLoser(source, "loser") : null;
  }

  return null;
};

// KNOCKOUT UPDATE
const updateKnockoutMatches = async (
  supabase: SupabaseClient,
  matches: MatchRow[],
  standings: StandingDraft[],
  dryRun: boolean,
) => {
  const matchesByNumber = new Map<number, MatchRow>();
  for (const match of matches) {
    const matchNumber = matchNumberOf(match);
    if (matchNumber !== null) matchesByNumber.set(matchNumber, match);
  }

  const usedThirdPlaceTeams = new Set<string>();
  let updated = 0;

  for (const match of [...matches].sort((left, right) => (matchNumberOf(left) ?? 999) - (matchNumberOf(right) ?? 999))) {
    const nextHome = resolvePlaceholder(match.home_team, matchesByNumber, standings, usedThirdPlaceTeams) ?? match.home_team;
    const nextAway = resolvePlaceholder(match.away_team, matchesByNumber, standings, usedThirdPlaceTeams) ?? match.away_team;
    if (nextHome === match.home_team && nextAway === match.away_team) continue;

    Object.assign(match, { home_team: nextHome, away_team: nextAway });
    updated += 1;

    if (!dryRun) {
      const { error } = await supabase
        .from("matches")
        .update({ away_team: nextAway, home_team: nextHome })
        .eq("id", match.id);
      if (error) throw error;
    }
  }

  return updated;
};

// SYNC RUN LOGS
const logSyncRun = async (supabase: SupabaseClient, summary: LiveResultsSyncSummary) => {
  const status = classifySyncStatus(summary.errors, summary.updatedMatches, summary.checkedMatches);
  const message = [
    `Auto sync ${status}`,
    `${summary.checkedMatches} checked`,
    `${summary.updatedMatches} updated`,
    `${summary.finishedMatches} finished`,
    `${summary.scoredPredictions} predictions scored`
  ].join("; ");

  // Ensure all errors are serialized strings
  const serializedErrors = summary.errors.map((error) => 
    typeof error === "string" ? error : serializeSyncError(error)
  );
  const errorsText = serializedErrors.join(" | ").slice(0, 2000);

  const extendedPayload = {
    checked_matches: summary.checkedMatches,
    error_message: serializedErrors.length ? errorsText : null,
    finished_at: summary.finishedAt,
    finished_matches: summary.finishedMatches,
    inserted_count: 0,
    knockout_updated: summary.knockoutUpdated,
    live_matches: summary.liveMatches,
    message,
    provider_name: summary.provider,
    ranking_updated: summary.rankingUpdated,
    scored_predictions: summary.scoredPredictions,
    standings_updated: summary.standingsUpdated,
    started_at: summary.startedAt,
    status,
    triggered_by: summary.triggeredBy,
    updated_count: summary.updatedMatches,
    updated_matches: summary.updatedMatches,
  };

  const { error } = await supabase.from("match_provider_runs").insert(extendedPayload);
  if (!error) return;

  await supabase.from("match_provider_runs").insert({
    inserted_count: 0,
    message: `${message}${serializedErrors.length ? `; errors: ${serializedErrors.join(" | ").slice(0, 1000)}` : ""}`,
    provider_name: summary.provider,
    status,
    updated_count: summary.updatedMatches,
    checked_matches: summary.checkedMatches,
    finished_matches: summary.finishedMatches,
    scored_predictions: summary.scoredPredictions,
  });
};

// CENTRAL LIVE RESULTS SYNC
export const runLiveResultsSync = async ({
  dryRun = false,
  force = false,
  now = new Date(),
  provider,
  supabase,
  triggeredBy,
}: RunLiveResultsSyncOptions): Promise<LiveResultsSyncSummary> => {
  const startedAt = new Date();
  const errors: string[] = [];
  const providerName = provider ?? (process.env.ESPN_PROVIDER_ENABLED === "false" ? "none" : "espn");

  let checkedMatches = 0;
  let updatedMatches = 0;
  let liveMatches = 0;
  let finishedMatches = 0;
  let scoredPredictions = 0;
  let rankingUpdated = 0;
  let standingsUpdated = 0;
  let knockoutUpdated = 0;

  try {
    const allMatches = await listMatches(supabase);
    const predictionLockMinutes = await readPredictionLockMinutes(supabase);
    const predictions = await listPredictions(supabase);
    const predictionsByMatch = groupPredictionsByMatch(predictions);
    const scopedMatches = allMatches.filter((match) => isInSyncScope(match, predictionsByMatch, now, force));
    checkedMatches = scopedMatches.length;

    updatedMatches += await updateLocalStatusWindows(supabase, scopedMatches, now, dryRun, predictionLockMinutes);

    const events = await fetchProviderEvents(scopedMatches, now, providerName, errors);
    for (const event of events) {
      const match = findMatchForEspnEvent(scopedMatches, event);
      if (!match) continue;
      const result = await applyEspnEvent(supabase, match, event, now, dryRun, predictionLockMinutes);
      updatedMatches += 1;
      if (result.live) liveMatches += 1;
      if (result.finished) finishedMatches += 1;
    }

    scoredPredictions = await scoreFinishedMatches(supabase, allMatches, predictionsByMatch, dryRun);
    rankingUpdated = await refreshRankings(supabase, predictions, allMatches, dryRun);
    const standingsResult = await refreshGroupStandings(supabase, allMatches, dryRun);
    standingsUpdated = standingsResult.changed;
    knockoutUpdated = await updateKnockoutMatches(supabase, allMatches, standingsResult.standings, dryRun);

    liveMatches = allMatches.filter((match) => match.status === "ao_vivo").length;
    finishedMatches = allMatches.filter((match) => match.status === "encerrado").length;
  } catch (error) {
    errors.push(serializeSyncError(error));
  }

  const summary: LiveResultsSyncSummary = {
    checkedMatches,
    dryRun,
    errors,
    finishedAt: new Date().toISOString(),
    finishedMatches,
    knockoutUpdated,
    liveMatches,
    provider: providerName,
    rankingUpdated,
    scoredPredictions,
    startedAt: startedAt.toISOString(),
    standingsUpdated,
    status: classifySyncStatus(errors, updatedMatches, checkedMatches),
    triggeredBy,
    updatedMatches,
  };

  if (!dryRun) await logSyncRun(supabase, summary);
  return summary;
};
