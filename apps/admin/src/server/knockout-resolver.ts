import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getPlaceholderSeedLabel,
  isKnockoutPlaceholder,
  parseKnockoutPlaceholder,
  predictionWindowPayload,
  resolveFlagUrlForTeam
} from "@gol-de-ouro/shared";

type JsonRecord = Record<string, unknown>;
type Side = "home" | "away";
type SourceResult = "winner" | "loser" | "fixed_team";

export type BracketPhase =
  | "group_stage"
  | "round_of_32"
  | "round_of_16"
  | "quarter_final"
  | "semi_final"
  | "third_place"
  | "final"
  | "unknown";

type MatchRow = {
  away_score?: number | null;
  away_seed?: string | null;
  away_original_placeholder?: string | null;
  away_source_match_number?: number | null;
  away_source_result?: string | null;
  away_team: string;
  away_team_code?: string | null;
  away_team_logo_url?: string | null;
  bracket_order?: number | null;
  bracket_phase?: BracketPhase | string | null;
  championship?: string | null;
  final_status?: string | null;
  home_score?: number | null;
  home_original_placeholder?: string | null;
  home_seed?: string | null;
  home_source_match_number?: number | null;
  home_source_result?: string | null;
  home_team: string;
  home_team_code?: string | null;
  home_team_logo_url?: string | null;
  id: string;
  match_code?: string | null;
  match_number?: number | null;
  penalty_away_score?: number | null;
  penalty_home_score?: number | null;
  provider_external_id?: string | null;
  round?: string | null;
  start_time?: string | null;
  stats?: JsonRecord | null;
  status?: string | null;
  tournament_id?: string | null;
  winner_team?: string | null;
  winner_team_code?: string | null;
};

export type BracketImportMatch = {
  away_seed?: string | null;
  away_source_match_number?: number | null;
  away_source_result?: SourceResult | string | null;
  away_team?: string | null;
  away_team_code?: string | null;
  bracket_order?: number | null;
  bracket_phase?: BracketPhase | string | null;
  home_seed?: string | null;
  home_source_match_number?: number | null;
  home_source_result?: SourceResult | string | null;
  home_team?: string | null;
  home_team_code?: string | null;
  match_number?: number | null;
  starts_at?: string | null;
};

export type BracketImportInput = {
  championship: string;
  dryRun?: boolean;
  matches: BracketImportMatch[];
  source?: string | null;
};

export type KnockoutResolutionSummary = {
  matchesChecked: number;
  participantsPending: number;
  participantsResolved: number;
  participantsSkipped: number;
  pending: number;
  resolved: number;
  skipped: number;
  warnings: string[];
};

export type BracketImportResult = {
  dryRun: boolean;
  errors: Array<{ index: number; match_number?: number | null; message: string }>;
  ok: boolean;
  summary: {
    invalid: number;
    matchesToCreate: number;
    matchesToUpdate: number;
    received: number;
    valid: number;
  };
};

const PHASES: BracketPhase[] = [
  "group_stage",
  "round_of_32",
  "round_of_16",
  "quarter_final",
  "semi_final",
  "third_place",
  "final",
  "unknown"
];

const MATCH_SELECT = [
  "id",
  "tournament_id",
  "championship",
  "match_number",
  "match_code",
  "home_team",
  "away_team",
  "home_team_code",
  "away_team_code",
  "home_team_logo_url",
  "away_team_logo_url",
  "home_score",
  "away_score",
  "status",
  "stats",
  "round",
  "provider_external_id",
  "bracket_phase",
  "bracket_order",
  "home_seed",
  "away_seed",
  "home_source_match_number",
  "away_source_match_number",
  "home_source_result",
  "away_source_result",
  "home_original_placeholder",
  "away_original_placeholder",
  "is_bracket_validated",
  "bracket_validation_error",
  "winner_team",
  "winner_team_code",
  "penalty_home_score",
  "penalty_away_score",
  "final_status"
].join(",");

export const emptyKnockoutResolutionSummary = (): KnockoutResolutionSummary => ({
  matchesChecked: 0,
  participantsPending: 0,
  participantsResolved: 0,
  participantsSkipped: 0,
  pending: 0,
  resolved: 0,
  skipped: 0,
  warnings: []
});

const readStats = (match: Pick<MatchRow, "stats">): JsonRecord =>
  match.stats && typeof match.stats === "object" && !Array.isArray(match.stats) ? match.stats : {};

const readNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const readString = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);

const matchNumberOf = (match: MatchRow) => match.match_number ?? readNumber(readStats(match).match_number);

const sideValue = (match: MatchRow, side: Side) => side === "home" ? match.home_team : match.away_team;

const sideCode = (match: MatchRow, side: Side) => side === "home" ? match.home_team_code : match.away_team_code;

const sourceNumber = (match: MatchRow, side: Side) =>
  side === "home" ? match.home_source_match_number : match.away_source_match_number;

const sourceResult = (match: MatchRow, side: Side): SourceResult | null => {
  const value = side === "home" ? match.home_source_result : match.away_source_result;
  return value === "winner" || value === "loser" || value === "fixed_team" ? value : null;
};

const seedValue = (match: MatchRow, side: Side) => side === "home" ? match.home_seed : match.away_seed;

const isRealTeam = (value?: string | null) => Boolean(value?.trim() && !isKnockoutPlaceholder(value));

const normalizePhase = (phase?: string | null): BracketPhase | null =>
  PHASES.includes(phase as BracketPhase) ? phase as BracketPhase : null;

const normalizeSourceResult = (value?: string | null): SourceResult | null => {
  if (value === "winner" || value === "loser" || value === "fixed_team") return value;
  return null;
};

const teamCodeFallback = (name?: string | null, code?: string | null) =>
  code?.trim() || name?.trim().slice(0, 3).toUpperCase() || null;

const matchNumberFromSeed = (seed?: string | null) => {
  const parsed = parseKnockoutPlaceholder(seed);
  return parsed?.kind === "match" ? parsed.matchNumber : null;
};

const addWarning = (summary: KnockoutResolutionSummary, warning: string) => {
  if (summary.warnings.includes(warning)) return;
  if (summary.warnings.length < 20) summary.warnings.push(warning);
};

const loadMatches = async (supabase: SupabaseClient, championship: string) => {
  const { data, error } = await supabase
    .from("matches")
    .select(MATCH_SELECT)
    .eq("championship", championship)
    .is("deleted_at", null);

  if (error) throw error;
  return (data ?? []) as unknown as MatchRow[];
};

const loadTournamentId = async (supabase: SupabaseClient, championship: string) => {
  const { data, error } = await supabase
    .from("tournaments")
    .select("id")
    .eq("slug", championship)
    .maybeSingle();

  if (error) throw error;
  return data?.id as string | undefined;
};

const buildMatchNumberMap = (matches: MatchRow[]) => {
  const map = new Map<number, MatchRow>();
  for (const match of matches) {
    const matchNumber = matchNumberOf(match);
    if (matchNumber !== null) map.set(matchNumber, match);
  }
  return map;
};

const validateImportMatch = (match: BracketImportMatch, index: number) => {
  const errors: string[] = [];
  const matchNumber = readNumber(match.match_number);
  const phase = normalizePhase(match.bracket_phase);

  if (matchNumber === null) errors.push("match_number obrigatorio.");
  if (!phase) errors.push("bracket_phase obrigatorio ou invalido.");

  const fixedHome = isRealTeam(match.home_team);
  const fixedAway = isRealTeam(match.away_team);
  const hasFixedTeams = fixedHome || fixedAway;

  if (hasFixedTeams && (!fixedHome || !fixedAway)) {
    errors.push("Confronto definido precisa de home_team e away_team reais.");
  }

  if (fixedHome && fixedAway) return errors;

  const homeResult = normalizeSourceResult(match.home_source_result) ?? (match.home_source_match_number ? "winner" : null);
  const awayResult = normalizeSourceResult(match.away_source_result) ?? (match.away_source_match_number ? "winner" : null);
  const homeSeed = match.home_seed?.trim();
  const awaySeed = match.away_seed?.trim();

  if (!homeSeed && !match.home_source_match_number) errors.push("Participante mandante futuro precisa de home_seed ou home_source_match_number.");
  if (!awaySeed && !match.away_source_match_number) errors.push("Participante visitante futuro precisa de away_seed ou away_source_match_number.");
  if (homeResult && homeResult !== "winner" && homeResult !== "loser") errors.push("home_source_result futuro deve ser winner ou loser.");
  if (awayResult && awayResult !== "winner" && awayResult !== "loser") errors.push("away_source_result futuro deve ser winner ou loser.");

  return errors.map((message) => `Item ${index + 1}: ${message}`);
};

const importPayloadFor = ({
  item,
  source,
  existing
}: {
  existing: MatchRow | null;
  item: BracketImportMatch;
  source: string;
}) => {
  const matchNumber = Number(item.match_number);
  const fixed = isRealTeam(item.home_team) && isRealTeam(item.away_team);
  const currentHome = existing?.home_team ?? "";
  const currentAway = existing?.away_team ?? "";
  const homeSeed = fixed ? item.home_team_code ?? item.home_team : item.home_seed ?? (item.home_source_match_number ? `W${item.home_source_match_number}` : null);
  const awaySeed = fixed ? item.away_team_code ?? item.away_team : item.away_seed ?? (item.away_source_match_number ? `W${item.away_source_match_number}` : null);
  const homeSourceResult = fixed ? "fixed_team" : normalizeSourceResult(item.home_source_result) ?? "winner";
  const awaySourceResult = fixed ? "fixed_team" : normalizeSourceResult(item.away_source_result) ?? "winner";
  const homeTeam = fixed
    ? item.home_team?.trim()
    : isRealTeam(currentHome) ? currentHome : homeSeed;
  const awayTeam = fixed
    ? item.away_team?.trim()
    : isRealTeam(currentAway) ? currentAway : awaySeed;

  return {
    away_original_placeholder: existing?.away_original_placeholder ?? (isKnockoutPlaceholder(currentAway) ? currentAway : null),
    away_seed: awaySeed,
    away_source_match_number: fixed ? null : item.away_source_match_number ?? matchNumberFromSeed(awaySeed),
    away_source_result: awaySourceResult,
    away_team: awayTeam,
    away_team_code: fixed ? item.away_team_code ?? teamCodeFallback(item.away_team, item.away_team_code) : existing?.away_team_code ?? null,
    away_team_logo_url: fixed ? resolveFlagUrlForTeam(item.away_team ?? "", existing?.away_team_logo_url) : existing?.away_team_logo_url ?? null,
    bracket_order: item.bracket_order ?? matchNumber,
    bracket_phase: normalizePhase(item.bracket_phase) ?? "unknown",
    bracket_validation_error: null,
    home_original_placeholder: existing?.home_original_placeholder ?? (isKnockoutPlaceholder(currentHome) ? currentHome : null),
    home_seed: homeSeed,
    home_source_match_number: fixed ? null : item.home_source_match_number ?? matchNumberFromSeed(homeSeed),
    home_source_result: homeSourceResult,
    home_team: homeTeam,
    home_team_code: fixed ? item.home_team_code ?? teamCodeFallback(item.home_team, item.home_team_code) : existing?.home_team_code ?? null,
    home_team_logo_url: fixed ? resolveFlagUrlForTeam(item.home_team ?? "", existing?.home_team_logo_url) : existing?.home_team_logo_url ?? null,
    is_bracket_validated: true,
    match_code: `J${matchNumber}`,
    match_number: matchNumber,
    round: normalizePhase(item.bracket_phase) ?? existing?.round ?? "unknown",
    stats: {
      ...readStats(existing ?? { stats: null }),
      bracket_source: source,
      match_number: matchNumber
    }
  };
};

export const importKnockoutBracket = async (
  supabase: SupabaseClient,
  input: BracketImportInput,
): Promise<BracketImportResult> => {
  const dryRun = input.dryRun !== false;
  const source = input.source?.trim() || "manual-official-bracket";
  const championship = input.championship?.trim();
  const errors: BracketImportResult["errors"] = [];

  if (!championship) {
    return {
      dryRun,
      errors: [{ index: -1, message: "championship obrigatorio." }],
      ok: false,
      summary: { invalid: 1, matchesToCreate: 0, matchesToUpdate: 0, received: input.matches?.length ?? 0, valid: 0 }
    };
  }

  if (!Array.isArray(input.matches) || input.matches.length === 0) {
    return {
      dryRun,
      errors: [{ index: -1, message: "matches obrigatorio e nao vazio." }],
      ok: false,
      summary: { invalid: 1, matchesToCreate: 0, matchesToUpdate: 0, received: 0, valid: 0 }
    };
  }

  const existingMatches = await loadMatches(supabase, championship);
  const matchesByNumber = buildMatchNumberMap(existingMatches);
  const tournamentId = await loadTournamentId(supabase, championship);
  const invalidIndexes = new Set<number>();
  let matchesToCreate = 0;
  let matchesToUpdate = 0;

  for (const [index, item] of input.matches.entries()) {
    const validationErrors = validateImportMatch(item, index);
    for (const message of validationErrors) {
      errors.push({ index, match_number: item.match_number, message });
    }
    if (validationErrors.length) {
      invalidIndexes.add(index);
      continue;
    }

    const matchNumber = Number(item.match_number);
    const existing = matchesByNumber.get(matchNumber) ?? null;
    if (existing) {
      matchesToUpdate += 1;
      continue;
    }

    matchesToCreate += 1;
    if (!item.starts_at) {
      invalidIndexes.add(index);
      errors.push({ index, match_number: item.match_number, message: "starts_at obrigatorio para criar partida nova." });
    }
    if (!tournamentId) {
      invalidIndexes.add(index);
      errors.push({ index, match_number: item.match_number, message: "Torneio da competicao nao encontrado." });
    }
  }

  const valid = input.matches.length - invalidIndexes.size;
  if (errors.length || dryRun) {
    return {
      dryRun,
      errors,
      ok: errors.length === 0,
      summary: {
        invalid: invalidIndexes.size,
        matchesToCreate,
        matchesToUpdate,
        received: input.matches.length,
        valid: Math.max(0, valid)
      }
    };
  }

  for (const item of input.matches) {
    const matchNumber = Number(item.match_number);
    const existing = matchesByNumber.get(matchNumber) ?? null;
    const payload = importPayloadFor({ existing, item, source });

    if (existing) {
      const { error } = await supabase.from("matches").update(payload).eq("id", existing.id);
      if (error) throw error;
      continue;
    }

    const startsAt = item.starts_at as string;
    const windowPayload = predictionWindowPayload(startsAt, 60);
    const { error } = await supabase.from("matches").insert({
      ...payload,
      away_score: 0,
      championship,
      home_score: 0,
      prediction_close_at: windowPayload.prediction_close_at,
      prediction_open_at: windowPayload.prediction_open_at,
      provider_external_id: `${championship}-knockout-${matchNumber}`,
      provider_name: source,
      start_time: startsAt,
      status: "fechado",
      tournament_id: tournamentId
    });
    if (error) throw error;
  }

  return {
    dryRun,
    errors: [],
    ok: true,
    summary: {
      invalid: 0,
      matchesToCreate,
      matchesToUpdate,
      received: input.matches.length,
      valid: input.matches.length
    }
  };
};

const sortedBracketMatches = (matches: MatchRow[]) =>
  [...matches].sort((left, right) => {
    const leftPhase = PHASES.indexOf(normalizePhase(left.bracket_phase) ?? "unknown");
    const rightPhase = PHASES.indexOf(normalizePhase(right.bracket_phase) ?? "unknown");
    return leftPhase - rightPhase
      || Number(left.bracket_order ?? matchNumberOf(left) ?? 9999) - Number(right.bracket_order ?? matchNumberOf(right) ?? 9999);
  });

const winnerByRecordedField = (match: MatchRow) => {
  const winnerTeam = readString(match.winner_team);
  if (winnerTeam && !isKnockoutPlaceholder(winnerTeam)) {
    return {
      code: match.winner_team_code ?? null,
      team: winnerTeam
    };
  }

  const winnerCode = readString(match.winner_team_code);
  if (winnerCode && winnerCode === match.home_team_code) return { code: match.home_team_code ?? null, team: match.home_team };
  if (winnerCode && winnerCode === match.away_team_code) return { code: match.away_team_code ?? null, team: match.away_team };
  return null;
};

const winnerLoserFor = (match: MatchRow, result: "winner" | "loser") => {
  if (match.status !== "encerrado") return null;

  const recordedWinner = winnerByRecordedField(match);
  if (recordedWinner && result === "winner") return recordedWinner;
  if (recordedWinner && result === "loser") {
    if (recordedWinner.team === match.home_team) return { code: match.away_team_code ?? null, team: match.away_team };
    if (recordedWinner.team === match.away_team) return { code: match.home_team_code ?? null, team: match.home_team };
  }

  const homeScore = Number(match.home_score ?? 0);
  const awayScore = Number(match.away_score ?? 0);
  const homePenalty = readNumber(match.penalty_home_score);
  const awayPenalty = readNumber(match.penalty_away_score);
  const homeWins = homeScore > awayScore || (homeScore === awayScore && homePenalty !== null && awayPenalty !== null && homePenalty > awayPenalty);
  const awayWins = awayScore > homeScore || (homeScore === awayScore && homePenalty !== null && awayPenalty !== null && awayPenalty > homePenalty);

  if (!homeWins && !awayWins) return null;

  const winningSide: Side = homeWins ? "home" : "away";
  const selectedSide: Side = result === "winner" ? winningSide : winningSide === "home" ? "away" : "home";
  return {
    code: sideCode(match, selectedSide) ?? null,
    team: sideValue(match, selectedSide)
  };
};

const seedFromSource = (match: MatchRow, side: Side) => {
  const seed = seedValue(match, side);
  if (seed) return seed;
  const source = sourceNumber(match, side);
  const result = sourceResult(match, side);
  if (source && result === "winner") return `W${source}`;
  if (source && result === "loser") return `L${source}`;
  return null;
};

export const resolveKnockoutBracket = async (
  supabase: SupabaseClient,
  championship = "world_cup_2026",
  dryRun = false,
): Promise<KnockoutResolutionSummary> => {
  const summary = emptyKnockoutResolutionSummary();
  const matches = await loadMatches(supabase, championship);
  const matchesByNumber = buildMatchNumberMap(matches);
  summary.matchesChecked = matches.length;

  for (const match of sortedBracketMatches(matches)) {
    const updates: Record<string, unknown> = {};
    const stats = { ...readStats(match) };

    for (const side of ["home", "away"] as Side[]) {
      const result = sourceResult(match, side);
      const source = sourceNumber(match, side);
      if (!source || (result !== "winner" && result !== "loser")) {
        summary.participantsSkipped += 1;
        continue;
      }

      const sourceMatch = matchesByNumber.get(source);
      const seed = seedFromSource(match, side);
      if (!sourceMatch) {
        summary.participantsPending += 1;
        addWarning(summary, `J${source} nao encontrado para resolver ${seed ?? "participante"}.`);
        continue;
      }

      const resolved = winnerLoserFor(sourceMatch, result);
      if (!resolved || !isRealTeam(resolved.team)) {
        summary.participantsPending += 1;
        continue;
      }

      const current = sideValue(match, side);
      const teamField = side === "home" ? "home_team" : "away_team";
      const codeField = side === "home" ? "home_team_code" : "away_team_code";
      const logoField = side === "home" ? "home_team_logo_url" : "away_team_logo_url";
      const resolvedAtField = side === "home" ? "home_resolved_at" : "away_resolved_at";
      const seedLabelField = side === "home" ? "home_seed_label" : "away_seed_label";

      // If current team is already real (not placeholder), trust ESPN over resolver
      if (isRealTeam(current)) {
        summary.participantsSkipped += 1;
        continue;
      }

      if (current === resolved.team && sideCode(match, side) === resolved.code) {
        summary.participantsSkipped += 1;
        continue;
      }

      updates[teamField] = resolved.team;
      updates[codeField] = resolved.code;
      updates[logoField] = resolveFlagUrlForTeam(resolved.team);
      stats[resolvedAtField] = new Date().toISOString();
      stats[seedLabelField] = getPlaceholderSeedLabel(seed) ?? seed;
      match[teamField] = resolved.team;
      match[codeField] = resolved.code;
      summary.participantsResolved += 1;
    }

    if (!Object.keys(updates).length) continue;

    updates.stats = stats;
    updates.bracket_validation_error = null;
    updates.is_bracket_validated = true;

    if (!dryRun) {
      const { error } = await supabase.from("matches").update(updates).eq("id", match.id);
      if (error) throw error;
    }
  }

  summary.resolved = summary.participantsResolved;
  summary.pending = summary.participantsPending;
  summary.skipped = summary.participantsSkipped;
  return summary;
};

export const resolveKnockoutParticipants = resolveKnockoutBracket;
