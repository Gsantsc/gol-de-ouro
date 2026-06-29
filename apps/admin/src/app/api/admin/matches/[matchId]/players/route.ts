import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { normalizeTeamNameWithAliases } from "@gol-de-ouro/shared";
import { createServiceSupabaseClient } from "@/server/sync-results";

type MatchPlayersRow = {
  away_team: string;
  away_team_code?: string | null;
  championship?: string | null;
  home_team: string;
  home_team_code?: string | null;
  id: string;
  status?: string | null;
};

type PlayerRow = {
  active: boolean;
  deleted_at?: string | null;
  id: string;
  name: string;
  position?: string | null;
  team_code?: string | null;
  team_name: string;
};

type CompetitionRosterRow = {
  championship: string;
  is_official: boolean;
  is_reserve?: boolean | null;
  player_id: string;
  position?: string | null;
  position_group?: string | null;
  roster_order?: number | null;
  shirt_number?: number | null;
  source?: string | null;
  team_code?: string | null;
  team_name?: string | null;
};

type RouteContext = {
  params: Promise<{ matchId: string }>;
};

const PLAYER_SELECT = "id,name,team_code,team_name,position,active,deleted_at";
const ROSTER_SELECT =
  "championship,player_id,team_code,team_name,is_official,source,position_group,position,shirt_number,is_reserve,roster_order";
const MATCH_SELECT_WITH_CODES = "id,home_team,away_team,home_team_code,away_team_code,championship,status";
const MATCH_SELECT_BASE = "id,home_team,away_team,championship,status";
const NO_REGISTERED_ROSTER_WARNING =
  "Elenco ainda nao sincronizado. Use 'Sincronizar jogadores' no Admin.";
const POSITION_ORDER = new Map([
  ["GOL", 0],
  ["DEF", 1],
  ["MEI", 2],
  ["ATA", 3],
  ["RS", 4],
]);

const requiredEnv = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`Variavel ${name} nao configurada.`);
  return value;
};

const createSupabaseForAdminSession = (accessToken: string) =>
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

const assertApprovedAdmin = async (accessToken: string) => {
  const supabase = createSupabaseForAdminSession(accessToken);
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return false;

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("role,approval_status,status,blocked,deleted_at")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (profileError) throw profileError;

  const profileStatus = profile?.status ?? (profile?.blocked ? "suspended" : profile?.approval_status);
  return Boolean(
    profile
    && profile.role === "admin"
    && profileStatus === "approved"
    && !profile.blocked
    && !profile.deleted_at,
  );
};

const isUuid = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(value);

const uniqueStrings = (values: Array<string | null | undefined>) =>
  Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]));

const normalizeTeamCode = (value?: string | null) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const normalizeComparableTeam = (value?: string | null) => {
  const cleaned = String(value ?? "").replace(/[_-]+/g, " ").trim();
  if (!cleaned) return "";
  return normalizeTeamNameWithAliases(cleaned);
};

const teamIdentifiersFor = (teamName: string, teamCode?: string | null) =>
  uniqueStrings([
    teamName,
    teamCode,
    normalizeTeamCode(teamName),
    normalizeTeamCode(normalizeTeamNameWithAliases(teamName)),
  ]).map(normalizeComparableTeam);

const missingTeamCodeColumn = (error: { message?: string; code?: string } | null) =>
  Boolean(error && (
    error.code === "PGRST204"
    || /home_team_code|away_team_code/i.test(error.message ?? "")
  ));

const loadMatch = async (supabase: SupabaseClient, matchId: string) => {
  const matchWithCodes = await supabase
    .from("matches")
    .select(MATCH_SELECT_WITH_CODES)
    .eq("id", matchId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!matchWithCodes.error) {
    return matchWithCodes.data as MatchPlayersRow | null;
  }

  if (!missingTeamCodeColumn(matchWithCodes.error)) {
    throw matchWithCodes.error;
  }

  const matchWithoutCodes = await supabase
    .from("matches")
    .select(MATCH_SELECT_BASE)
    .eq("id", matchId)
    .is("deleted_at", null)
    .maybeSingle();

  if (matchWithoutCodes.error) throw matchWithoutCodes.error;
  return matchWithoutCodes.data as MatchPlayersRow | null;
};

const loadOfficialRosters = async (supabase: SupabaseClient, championship?: string | null) => {
  if (!championship) return [];

  const { data, error } = await supabase
    .from("competition_rosters")
    .select(ROSTER_SELECT)
    .eq("championship", championship)
    .eq("is_official", true);

  if (error) throw error;
  return (data ?? []) as CompetitionRosterRow[];
};

const loadRosterPlayers = async (
  supabase: SupabaseClient,
  rosters: CompetitionRosterRow[],
) => {
  const playerIds = uniqueStrings(rosters.map((roster) => roster.player_id));
  if (playerIds.length === 0) return [];

  const { data, error } = await supabase
    .from("players")
    .select(PLAYER_SELECT)
    .eq("active", true)
    .is("deleted_at", null)
    .in("id", playerIds);
  if (error) throw error;

  return (data ?? []) as PlayerRow[];
};

const belongsToTeam = (
  player: PlayerRow,
  roster: CompetitionRosterRow | undefined,
  teamIdentifiers: string[],
) => {
  const identifiers = uniqueStrings([
    player.team_name,
    player.team_code,
    roster?.team_name,
    roster?.team_code,
    normalizeTeamCode(player.team_name),
    player.team_code ? normalizeTeamCode(player.team_code) : null,
    roster?.team_name ? normalizeTeamCode(roster.team_name) : null,
    roster?.team_code ? normalizeTeamCode(roster.team_code) : null,
  ]).map(normalizeComparableTeam);

  return identifiers.some((identifier) => teamIdentifiers.includes(identifier));
};

const normalizePositionGroup = (value?: string | null) => {
  const normalized = String(value ?? "").trim().toUpperCase();
  return normalized || null;
};

const isReserveRoster = (roster: CompetitionRosterRow) =>
  Boolean(roster.is_reserve) || normalizePositionGroup(roster.position_group) === "RS";

const rosterPositionRank = (roster: CompetitionRosterRow) => {
  if (isReserveRoster(roster)) return POSITION_ORDER.get("RS") ?? 4;
  return POSITION_ORDER.get(normalizePositionGroup(roster.position_group) ?? "") ?? 99;
};

const toResponsePlayer = (player: PlayerRow, roster: CompetitionRosterRow) => ({
  active: player.active,
  id: player.id,
  name: player.name,
  is_reserve: isReserveRoster(roster),
  position: roster.position ?? player.position ?? null,
  position_group: normalizePositionGroup(roster.position_group),
  roster: {
    championship: roster.championship,
    is_official: roster.is_official,
    is_reserve: isReserveRoster(roster),
    position: roster.position ?? player.position ?? null,
    position_group: normalizePositionGroup(roster.position_group),
    roster_order: roster.roster_order ?? null,
    shirt_number: roster.shirt_number ?? null,
    source: roster.source ?? null,
  },
  roster_order: roster.roster_order ?? null,
  shirt_number: roster.shirt_number ?? null,
  team_code: roster.team_code ?? player.team_code ?? null,
  team_name: roster.team_name ?? player.team_name,
});

const sortRosterPlayers = (players: Array<{ player: PlayerRow; roster: CompetitionRosterRow }>) =>
  [...players].sort((first, second) => {
    const firstReserve = isReserveRoster(first.roster) ? 1 : 0;
    const secondReserve = isReserveRoster(second.roster) ? 1 : 0;
    if (firstReserve !== secondReserve) return firstReserve - secondReserve;

    const firstPosition = rosterPositionRank(first.roster);
    const secondPosition = rosterPositionRank(second.roster);
    if (firstPosition !== secondPosition) return firstPosition - secondPosition;

    const firstOrder = first.roster.roster_order ?? Number.MAX_SAFE_INTEGER;
    const secondOrder = second.roster.roster_order ?? Number.MAX_SAFE_INTEGER;
    if (firstOrder !== secondOrder) return firstOrder - secondOrder;

    return first.player.name.localeCompare(second.player.name, "pt-BR");
  });

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
    if (!accessToken) {
      return NextResponse.json({ error: "Token de autorizacao nao enviado." }, { status: 401 });
    }

    if (!await assertApprovedAdmin(accessToken)) {
      return NextResponse.json({ error: "Token invalido ou admin nao aprovado." }, { status: 403 });
    }

    const { matchId } = await context.params;
    if (!isUuid(matchId)) {
      return NextResponse.json({ error: "Partida invalida." }, { status: 400 });
    }

    const supabase = createServiceSupabaseClient();
    const match = await loadMatch(supabase, matchId);
    if (!match) {
      return NextResponse.json({ error: "Partida nao encontrada." }, { status: 404 });
    }

    const homeTeamCode = match.home_team_code ?? normalizeTeamCode(normalizeTeamNameWithAliases(match.home_team));
    const awayTeamCode = match.away_team_code ?? normalizeTeamCode(normalizeTeamNameWithAliases(match.away_team));
    const baseResponse = {
      match: {
        away_team: match.away_team,
        away_team_code: awayTeamCode,
        championship: match.championship ?? null,
        home_team: match.home_team,
        home_team_code: homeTeamCode,
        id: match.id,
        status: match.status ?? null,
      },
      rosterFilter: {
        championship: match.championship ?? null,
        usesOfficialRosterFilter: true,
      },
    };

    const officialRosters = await loadOfficialRosters(supabase, match.championship);
    if (officialRosters.length === 0) {
      return NextResponse.json({
        ...baseResponse,
        awayTeam: {
          code: awayTeamCode,
          name: match.away_team,
          players: [],
        },
        homeTeam: {
          code: homeTeamCode,
          name: match.home_team,
          players: [],
        },
        ok: true,
        rosterFilter: {
          ...baseResponse.rosterFilter,
          warning: NO_REGISTERED_ROSTER_WARNING,
        },
      });
    }

    const rosterByPlayerId = new Map(officialRosters.map((roster) => [roster.player_id, roster]));
    const players = await loadRosterPlayers(supabase, officialRosters);
    const homeIdentifiers = teamIdentifiersFor(match.home_team, homeTeamCode);
    const awayIdentifiers = teamIdentifiersFor(match.away_team, awayTeamCode);

    const officialPlayers = players.flatMap((player) => {
      const roster = rosterByPlayerId.get(player.id);
      return roster ? [{ player, roster }] : [];
    });
    const homePlayers = sortRosterPlayers(
      officialPlayers.filter(({ player, roster }) => belongsToTeam(player, roster, homeIdentifiers)),
    );
    const awayPlayers = sortRosterPlayers(
      officialPlayers.filter(({ player, roster }) => belongsToTeam(player, roster, awayIdentifiers)),
    );

    return NextResponse.json({
      ...baseResponse,
      awayTeam: {
        code: awayTeamCode,
        name: match.away_team,
        players: awayPlayers.map(({ player, roster }) => toResponsePlayer(player, roster)),
      },
      homeTeam: {
        code: homeTeamCode,
        name: match.home_team,
        players: homePlayers.map(({ player, roster }) => toResponsePlayer(player, roster)),
      },
      ok: true,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao listar jogadores da partida." },
      { status: 500 },
    );
  }
}
