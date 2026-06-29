import type { SupabaseClient } from "@supabase/supabase-js";

export type PositionGroup = "GOL" | "DEF" | "MEI" | "ATA" | "RS";

export type ProviderRosterPlayer = {
  external_id: string | null;
  name: string;
  display_name?: string | null;
  team_name: string;
  team_code: string;
  position: string | null;
  position_group: PositionGroup | null;
  shirt_number: number | null;
  roster_order: number | null;
  is_reserve: boolean;
  source: string;
};

export type FetchTeamRosterInput = {
  championship: string;
  teamName: string;
  teamCode: string;
  providerTeamId?: string | null;
};

export type TeamNeedingRoster = {
  team_code: string;
  team_name: string;
  provider_team_id?: string | null;
};

type ApiFootballTeam = {
  team?: {
    code?: string | null;
    country?: string | null;
    id?: number | string | null;
    name?: string | null;
  } | null;
};

type ApiFootballSquad = {
  players?: Array<{
    id?: number | string | null;
    name?: string | null;
    number?: number | string | null;
    position?: string | null;
  }> | null;
  team?: {
    id?: number | string | null;
    name?: string | null;
  } | null;
};

type ApiFootballEnvelope<T> = {
  errors?: unknown;
  response?: T;
};

type EspnAthlete = {
  displayName?: string | null;
  fullName?: string | null;
  id?: string | number | null;
  jersey?: string | number | null;
  name?: string | null;
  position?: {
    abbreviation?: string | null;
    displayName?: string | null;
    name?: string | null;
  } | string | null;
  shortName?: string | null;
};

type EspnRosterGroup = {
  displayName?: string | null;
  items?: EspnAthlete[] | null;
  name?: string | null;
  position?: string | null;
};

type EspnRosterEntry = {
  athlete: EspnAthlete;
  group?: EspnRosterGroup;
};

type MatchTeamRow = {
  away_team?: string | null;
  away_team_code?: string | null;
  away_team_id?: string | null;
  home_team?: string | null;
  home_team_code?: string | null;
  home_team_id?: string | null;
  stats?: unknown;
};

type TeamRow = {
  external_id?: string | null;
  id: string;
  name?: string | null;
};

type TeamCandidate = {
  providerTeamId?: string | null;
  stats?: unknown;
  teamCode?: string | null;
  teamId?: string | null;
  teamName?: string | null;
};

const API_FOOTBALL_SOURCE = "api-football-roster-sync";
const ESPN_SOURCE = "espn-roster-sync";
const DEFAULT_TIMEOUT_MS = 25000;
const POSITION_GROUPS = new Set<PositionGroup>(["GOL", "DEF", "MEI", "ATA", "RS"]);

const leagueIds: Record<string, number> = {
  brasileirao_a: 71,
  champions_league: 2,
  copa_do_brasil: 73,
  libertadores: 13,
  sul_americana: 11,
  world_cup_2026: 1,
};

export class RosterProviderError extends Error {
  warnings: string[];

  constructor(message: string, warnings: string[] = []) {
    super(message);
    this.name = "RosterProviderError";
    this.warnings = warnings;
  }
}

const logRoster = (message: string, level: "info" | "warn" | "error" = "info") => {
  const prefix = `[ROSTER ${new Date().toISOString()}]`;
  if (level === "error") console.error(`${prefix} ${message}`);
  else if (level === "warn") console.warn(`${prefix} ${message}`);
  else if (process.env.NODE_ENV !== "production") console.log(`${prefix} ${message}`);
};

const normalizeText = (value?: string | null) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const normalizeComparable = (value?: string | null) =>
  normalizeText(value)
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeCode = (value?: string | null) =>
  normalizeText(value)
    .replace(/[^a-z0-9]+/g, "")
    .toUpperCase();

const deriveTeamCode = (teamName: string) => {
  const words = normalizeComparable(teamName).split(" ").filter(Boolean);
  const initials = words.length > 1 ? words.map((word) => word[0]).join("") : "";
  const fallback = normalizeCode(teamName).slice(0, 3);
  return (initials || fallback || "TBD").slice(0, 3).toUpperCase();
};

export const inferPositionGroup = (position?: string | null): PositionGroup | null => {
  const normalized = normalizeComparable(position);
  if (!normalized) return null;
  if (/(^|\s)(gk|goalkeeper|goleiro|goleira)(\s|$)/i.test(normalized)) return "GOL";
  if (/(defender|defensor|defesa|zagueiro|zagueira|lateral|back|fullback|centre back|center back)/i.test(normalized)) return "DEF";
  if (/(midfield|midfielder|meia|meio campo|volante)/i.test(normalized)) return "MEI";
  if (/(attacker|forward|striker|winger|atacante|ponta|ataque)/i.test(normalized)) return "ATA";
  if (/(reserve|reserva|(^|\s)rs(\s|$))/i.test(normalized)) return "RS";
  return null;
};

const normalizePositionGroup = (value?: string | null): PositionGroup | null => {
  const normalized = String(value ?? "").trim().toUpperCase();
  return POSITION_GROUPS.has(normalized as PositionGroup) ? normalized as PositionGroup : null;
};

const toPositiveInteger = (value: unknown, min = 1, max = Number.MAX_SAFE_INTEGER) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) return null;
  return parsed;
};

const getApiFootballBaseUrl = () =>
  process.env.API_FOOTBALL_BASE_URL || "https://v3.football.api-sports.io";

const seasonForChampionship = (championship: string) => {
  const envSeason = Number(process.env.API_FOOTBALL_ROSTER_SEASON ?? process.env.API_FOOTBALL_SEASON);
  if (Number.isInteger(envSeason) && envSeason > 1900) return envSeason;
  return championship === "world_cup_2026" ? 2026 : 2026;
};

const readJsonMap = (envNames: string[]) => {
  for (const envName of envNames) {
    const raw = process.env[envName];
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw) as Record<string, string | number | null | undefined>;
      return parsed;
    } catch (error) {
      logRoster(`${envName} invalido: ${error instanceof Error ? error.message : "JSON invalido"}`, "warn");
      return {};
    }
  }

  return {};
};

const lookupMappedTeamId = (map: Record<string, string | number | null | undefined>, teamName: string, teamCode: string) => {
  const candidates = [
    teamCode,
    teamCode.toUpperCase(),
    teamName,
    normalizeComparable(teamName),
    normalizeCode(teamName),
  ];

  for (const candidate of candidates) {
    const value = map[candidate];
    if (value !== null && value !== undefined && String(value).trim()) return String(value).trim();
  }

  return null;
};

const hasEnvelopeErrors = (errors: unknown) => {
  if (!errors) return false;
  if (Array.isArray(errors)) return errors.length > 0;
  if (typeof errors === "object") return Object.keys(errors as Record<string, unknown>).length > 0;
  if (typeof errors === "string") return errors.trim().length > 0;
  return true;
};

const fetchJsonWithTimeout = async <Result,>(
  url: URL,
  init: RequestInit,
  provider: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
) => {
  const response = await fetch(url.toString(), {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`${provider} HTTP ${response.status}`);
  }

  return await response.json() as Result;
};

const apiFootballHeaders = (apiKey: string) => ({
  "x-apisports-host": "v3.football.api-sports.io",
  "x-apisports-key": apiKey,
});

const selectBestApiFootballTeam = (teams: ApiFootballTeam[], teamName: string, teamCode: string) => {
  const expectedName = normalizeComparable(teamName);
  const expectedCode = normalizeCode(teamCode);

  const scored = teams.flatMap((item) => {
    const team = item.team;
    if (!team?.id) return [];

    const candidateName = normalizeComparable(team.name);
    const candidateCode = normalizeCode(team.code);
    const candidateCountry = normalizeComparable(team.country);
    let score = 0;

    if (expectedCode && candidateCode === expectedCode) score += 100;
    if (expectedName && candidateName === expectedName) score += 80;
    if (expectedName && candidateCountry === expectedName) score += 40;
    if (expectedName && (candidateName.includes(expectedName) || expectedName.includes(candidateName))) score += 20;

    return score > 0 ? [{ id: String(team.id), score }] : [];
  });

  scored.sort((left, right) => right.score - left.score);
  return scored[0]?.id ?? null;
};

const resolveApiFootballTeamId = async (
  input: FetchTeamRosterInput,
  apiKey: string,
  warnings: string[],
) => {
  const providerTeamId = input.providerTeamId?.trim();
  if (providerTeamId && /^\d+$/.test(providerTeamId)) return providerTeamId;
  if (providerTeamId) {
    warnings.push(`Provider team id ignorado para ${input.teamName}: "${providerTeamId}" nao e numerico para API-Football.`);
  }

  const mappedId = lookupMappedTeamId(
    readJsonMap(["API_FOOTBALL_TEAM_IDS", "ROSTER_PROVIDER_TEAM_IDS"]),
    input.teamName,
    input.teamCode,
  );
  if (mappedId && /^\d+$/.test(mappedId)) return mappedId;

  const leagueId = leagueIds[input.championship];
  const season = seasonForChampionship(input.championship);
  const attempts: URL[] = [];
  const addAttempt = (params: Record<string, string | number | null | undefined>) => {
    const url = new URL(`${getApiFootballBaseUrl()}/teams`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== null && value !== undefined && String(value).trim()) {
        url.searchParams.set(key, String(value));
      }
    }
    if (!attempts.some((attempt) => attempt.toString() === url.toString())) attempts.push(url);
  };

  if (input.teamCode) addAttempt({ code: input.teamCode });
  addAttempt({ league: leagueId, search: input.teamName, season });
  addAttempt({ league: leagueId, name: input.teamName, season });
  addAttempt({ search: input.teamName });

  for (const url of attempts) {
    try {
      const envelope = await fetchJsonWithTimeout<ApiFootballEnvelope<ApiFootballTeam[]>>(
        url,
        { headers: apiFootballHeaders(apiKey) },
        "API-Football teams",
      );

      if (hasEnvelopeErrors(envelope.errors)) {
        warnings.push(`API-Football retornou erro ao buscar time ${input.teamName}.`);
        continue;
      }

      const teamId = selectBestApiFootballTeam(envelope.response ?? [], input.teamName, input.teamCode);
      if (teamId) return teamId;
    } catch (error) {
      warnings.push(`Falha ao buscar team id API-Football para ${input.teamName}: ${error instanceof Error ? error.message : "erro desconhecido"}.`);
    }
  }

  warnings.push(`API-Football nao encontrou team id para ${input.teamName} (${input.teamCode}).`);
  return null;
};

export const fetchApiFootballRoster = async (
  input: FetchTeamRosterInput,
  apiKey = process.env.API_FOOTBALL_KEY,
): Promise<ProviderRosterPlayer[]> => {
  if (!apiKey) return [];

  const warnings: string[] = [];
  const teamId = await resolveApiFootballTeamId(input, apiKey, warnings);
  warnings.forEach((warning) => logRoster(warning, "warn"));
  if (!teamId) return [];

  const url = new URL(`${getApiFootballBaseUrl()}/players/squads`);
  url.searchParams.set("team", teamId);

  logRoster(`API-Football roster start: ${input.teamName} (${input.teamCode}) team=${teamId}`);
  const envelope = await fetchJsonWithTimeout<ApiFootballEnvelope<ApiFootballSquad[]>>(
    url,
    { headers: apiFootballHeaders(apiKey) },
    "API-Football roster",
  );

  if (hasEnvelopeErrors(envelope.errors)) {
    logRoster(`API-Football retornou erro de roster para ${input.teamName}.`, "warn");
    return [];
  }

  const players = (envelope.response ?? []).flatMap((squad) => squad.players ?? []);
  const seen = new Set<string>();

  return players.flatMap((player, index) => {
    const name = player.name?.trim();
    if (!name) return [];

    const externalId = player.id !== null && player.id !== undefined ? String(player.id) : null;
    const dedupeKey = externalId ? `id:${externalId}` : `name:${normalizeComparable(name)}`;
    if (seen.has(dedupeKey)) return [];
    seen.add(dedupeKey);

    const position = player.position?.trim() || null;
    const positionGroup = inferPositionGroup(position);

    return [{
      display_name: name,
      external_id: externalId,
      is_reserve: positionGroup === "RS",
      name,
      position,
      position_group: positionGroup === "RS" ? null : positionGroup,
      roster_order: index + 1,
      shirt_number: toPositiveInteger(player.number, 1, 99),
      source: API_FOOTBALL_SOURCE,
      team_code: input.teamCode,
      team_name: input.teamName,
    }];
  });
};

const resolveEspnTeamId = (input: FetchTeamRosterInput) => {
  const mappedId = lookupMappedTeamId(
    readJsonMap(["ESPN_TEAM_IDS", "ESPN_SOCCER_TEAM_IDS"]),
    input.teamName,
    input.teamCode,
  );
  if (mappedId) return mappedId;

  if (process.env.ROSTER_PROVIDER_TEAM_ID_SOURCE === "espn" && input.providerTeamId) {
    return input.providerTeamId;
  }

  return null;
};

const readEspnAthletePosition = (athlete: EspnAthlete, group?: EspnRosterGroup) => {
  if (typeof athlete.position === "string") return athlete.position.trim() || null;
  return athlete.position?.displayName
    ?? athlete.position?.name
    ?? athlete.position?.abbreviation
    ?? group?.displayName
    ?? group?.name
    ?? group?.position
    ?? null;
};

export const fetchEspnRoster = async (
  input: FetchTeamRosterInput,
): Promise<ProviderRosterPlayer[]> => {
  const teamId = resolveEspnTeamId(input);
  if (!teamId) return [];

  const league = process.env.ESPN_SOCCER_LEAGUE || "fifa.world";
  const baseUrl = process.env.ESPN_SOCCER_BASE_URL || "https://site.api.espn.com/apis/site/v2/sports/soccer";
  const url = new URL(`${baseUrl}/${league}/teams/${teamId}/roster`);

  logRoster(`ESPN roster start: ${input.teamName} (${input.teamCode}) team=${teamId}`);
  const payload = await fetchJsonWithTimeout<{ athletes?: Array<EspnRosterGroup | EspnAthlete> }>(
    url,
    {},
    "ESPN roster",
  );

  const athletes: EspnRosterEntry[] = (payload.athletes ?? []).flatMap((entry): EspnRosterEntry[] => {
    if ("items" in entry && Array.isArray(entry.items)) {
      return entry.items.map((athlete) => ({ athlete, group: entry as EspnRosterGroup }));
    }

    return [{ athlete: entry as EspnAthlete }];
  });
  const seen = new Set<string>();

  return athletes.flatMap(({ athlete, group }, index) => {
    const name = athlete.fullName?.trim() || athlete.displayName?.trim() || athlete.name?.trim() || athlete.shortName?.trim();
    if (!name) return [];

    const externalId = athlete.id !== null && athlete.id !== undefined ? String(athlete.id) : null;
    const dedupeKey = externalId ? `id:${externalId}` : `name:${normalizeComparable(name)}`;
    if (seen.has(dedupeKey)) return [];
    seen.add(dedupeKey);

    const position = readEspnAthletePosition(athlete, group);
    const positionGroup = inferPositionGroup(position);

    return [{
      display_name: athlete.displayName ?? name,
      external_id: externalId,
      is_reserve: positionGroup === "RS",
      name,
      position,
      position_group: positionGroup === "RS" ? null : positionGroup,
      roster_order: index + 1,
      shirt_number: toPositiveInteger(athlete.jersey, 1, 99),
      source: ESPN_SOURCE,
      team_code: input.teamCode,
      team_name: input.teamName,
    }];
  });
};

export const fetchTeamRoster = async (
  input: FetchTeamRosterInput,
): Promise<ProviderRosterPlayer[]> => {
  const warnings: string[] = [];
  logRoster(`Roster sync team start: ${input.teamName} (${input.teamCode}) championship=${input.championship}`);

  if (process.env.API_FOOTBALL_KEY) {
    try {
      const roster = await fetchApiFootballRoster(input);
      if (roster.length > 0) {
        logRoster(`API-Football roster success: ${input.teamName} players=${roster.length}`);
        return roster.map((player) => ({
          ...player,
          position_group: player.position_group ?? inferPositionGroup(player.position),
        }));
      }

      warnings.push(`API-Football nao retornou elenco para ${input.teamName} (${input.teamCode}).`);
    } catch (error) {
      warnings.push(`API-Football falhou para ${input.teamName} (${input.teamCode}): ${error instanceof Error ? error.message : "erro desconhecido"}.`);
    }
  } else {
    warnings.push("API_FOOTBALL_KEY nao configurada.");
  }

  try {
    const roster = await fetchEspnRoster(input);
    if (roster.length > 0) {
      logRoster(`ESPN roster success: ${input.teamName} players=${roster.length}`);
      return roster.map((player) => ({
        ...player,
        position_group: player.position_group ?? inferPositionGroup(player.position),
      }));
    }

    warnings.push(`ESPN nao retornou elenco para ${input.teamName} (${input.teamCode}) ou nao ha teamId confiavel.`);
  } catch (error) {
    warnings.push(`ESPN falhou para ${input.teamName} (${input.teamCode}): ${error instanceof Error ? error.message : "erro desconhecido"}.`);
  }

  const message = `Provider nao retornou elenco para ${input.teamName} (${input.teamCode}).`;
  logRoster(message, "warn");
  throw new RosterProviderError(message, warnings);
};

const isPlaceholderTeam = (teamName?: string | null) => {
  const raw = String(teamName ?? "").trim();
  if (!raw) return true;

  const normalized = normalizeComparable(raw);
  const compact = raw.toUpperCase().replace(/\s+/g, "");
  if (/^(W|L)\d{1,3}(?:\/(?:W|L)?\d{1,3})*$/.test(compact)) return true;

  return [
    "a definir",
    "to be determined",
    "tbd",
    "winner group",
    "winner match",
    "runner up group",
    "runner-up group",
    "third place group",
    "loser match",
    "vencedor",
    "perdedor",
  ].some((pattern) => normalized.includes(pattern));
};

const readStatsTeamId = (stats: unknown, side: "home" | "away") => {
  if (!stats || typeof stats !== "object") return null;
  const record = stats as Record<string, unknown>;
  const nested = record[side];
  const nestedTeam = nested && typeof nested === "object" ? (nested as Record<string, unknown>).team : null;
  const teams = record.teams && typeof record.teams === "object" ? record.teams as Record<string, unknown> : null;
  const teamsSide = teams?.[side];

  const candidates = [
    record[`${side}_team_id`],
    record[`${side}TeamId`],
    record[`${side}_api_football_team_id`],
    record[`${side}ApiFootballTeamId`],
    nested && typeof nested === "object" ? (nested as Record<string, unknown>).id : null,
    nestedTeam && typeof nestedTeam === "object" ? (nestedTeam as Record<string, unknown>).id : null,
    teamsSide && typeof teamsSide === "object" ? (teamsSide as Record<string, unknown>).id : null,
  ];

  const found = candidates.find((value) => value !== null && value !== undefined && String(value).trim());
  return found ? String(found).trim() : null;
};

const getMatchesWithTeams = async (supabase: SupabaseClient, championship: string) => {
  const fullSelect = [
    "home_team",
    "home_team_code",
    "home_team_id",
    "away_team",
    "away_team_code",
    "away_team_id",
    "stats",
  ].join(",");

  const fullResult = await supabase
    .from("matches")
    .select(fullSelect)
    .eq("championship", championship)
    .is("deleted_at", null);

  if (!fullResult.error) return (fullResult.data ?? []) as MatchTeamRow[];

  logRoster(`Busca de times com colunas completas falhou: ${fullResult.error.message}. Tentando fallback.`, "warn");
  const fallbackResult = await supabase
    .from("matches")
    .select("home_team,home_team_code,away_team,away_team_code,stats")
    .eq("championship", championship)
    .is("deleted_at", null);

  if (fallbackResult.error) {
    logRoster(`Busca de times com codigos falhou: ${fallbackResult.error.message}. Tentando fallback por nome.`, "warn");
    const nameOnlyResult = await supabase
      .from("matches")
      .select("home_team,away_team,stats")
      .eq("championship", championship)
      .is("deleted_at", null);

    if (nameOnlyResult.error) throw nameOnlyResult.error;
    return (nameOnlyResult.data ?? []) as MatchTeamRow[];
  }

  return (fallbackResult.data ?? []) as MatchTeamRow[];
};

const loadTeamsById = async (supabase: SupabaseClient, ids: string[]) => {
  if (ids.length === 0) return new Map<string, TeamRow>();

  const { data, error } = await supabase
    .from("teams")
    .select("id,external_id,name")
    .in("id", ids)
    .is("deleted_at", null);

  if (error) {
    logRoster(`Nao foi possivel buscar public.teams: ${error.message}`, "warn");
    return new Map<string, TeamRow>();
  }

  return new Map(((data ?? []) as TeamRow[]).map((team) => [team.id, team]));
};

export const getTeamsNeedingRoster = async (
  supabase: SupabaseClient,
  championship: string,
): Promise<TeamNeedingRoster[]> => {
  const matches = await getMatchesWithTeams(supabase, championship);
  const teamIds = Array.from(new Set(matches.flatMap((match) => [
    match.home_team_id,
    match.away_team_id,
  ]).filter(Boolean) as string[]));
  const teamsById = await loadTeamsById(supabase, teamIds);
  const teamsMap = new Map<string, TeamNeedingRoster>();

  const addTeam = ({ providerTeamId, stats, teamCode, teamId, teamName }: TeamCandidate, side: "home" | "away") => {
    const name = teamName?.trim();
    if (!name || isPlaceholderTeam(name)) return;

    const explicitCode = normalizeCode(teamCode);
    const code = explicitCode || deriveTeamCode(name);
    const key = explicitCode ? `code:${explicitCode}` : `name:${normalizeComparable(name)}`;
    const linkedProviderId = teamId ? teamsById.get(teamId)?.external_id ?? null : null;
    const statsProviderId = readStatsTeamId(stats, side);
    const nextProviderId = providerTeamId ?? linkedProviderId ?? statsProviderId ?? null;
    const existing = teamsMap.get(key);

    if (!existing) {
      teamsMap.set(key, {
        provider_team_id: nextProviderId,
        team_code: code,
        team_name: name,
      });
      return;
    }

    if (!existing.provider_team_id && nextProviderId) {
      teamsMap.set(key, {
        ...existing,
        provider_team_id: nextProviderId,
      });
    }
  };

  for (const match of matches) {
    addTeam({
      stats: match.stats,
      teamCode: match.home_team_code,
      teamId: match.home_team_id,
      teamName: match.home_team,
    }, "home");
    addTeam({
      stats: match.stats,
      teamCode: match.away_team_code,
      teamId: match.away_team_id,
      teamName: match.away_team,
    }, "away");
  }

  return Array.from(teamsMap.values()).sort((left, right) => left.team_code.localeCompare(right.team_code));
};
