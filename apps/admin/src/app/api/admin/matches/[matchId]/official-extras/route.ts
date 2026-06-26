import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { normalizeTeamNameWithAliases } from "@gol-de-ouro/shared";
import { createServiceSupabaseClient } from "@/server/sync-results";

type MatchExtrasRow = {
  away_team: string;
  away_team_code?: string | null;
  championship?: string | null;
  first_goal_no_goals?: boolean | null;
  first_goal_scorer?: string | null;
  first_goal_scorer_id?: string | null;
  home_team: string;
  home_team_code?: string | null;
  id: string;
  man_of_match?: string | null;
  man_of_match_id?: string | null;
  red_card_happened?: boolean | null;
  red_cards_away?: number | null;
  red_cards_home?: number | null;
};

type MatchExtrasUpdate = Partial<Pick<
  MatchExtrasRow,
  | "first_goal_no_goals"
  | "first_goal_scorer"
  | "first_goal_scorer_id"
  | "man_of_match"
  | "man_of_match_id"
  | "red_card_happened"
  | "red_cards_away"
  | "red_cards_home"
>>;

type PlayerRow = {
  active?: boolean | null;
  deleted_at?: string | null;
  id: string;
  name: string;
  team_code?: string | null;
  team_name: string;
};

type CompetitionRosterRow = {
  championship: string;
  is_official: boolean;
  player_id: string;
  team_code?: string | null;
  team_name?: string | null;
};

type OfficialExtrasPayload = {
  first_goal_no_goals?: unknown;
  first_goal_scorer_id?: unknown;
  man_of_match_id?: unknown;
  red_card_happened?: unknown;
  red_cards_away?: unknown;
  red_cards_home?: unknown;
};

type RouteContext = {
  params: Promise<{ matchId: string }>;
};

const MATCH_SELECT_WITH_CODES =
  "id,home_team,away_team,home_team_code,away_team_code,championship,first_goal_scorer_id,first_goal_scorer,first_goal_no_goals,man_of_match_id,man_of_match,red_card_happened,red_cards_home,red_cards_away";
const MATCH_SELECT_BASE =
  "id,home_team,away_team,championship,first_goal_scorer_id,first_goal_scorer,first_goal_no_goals,man_of_match_id,man_of_match,red_card_happened,red_cards_home,red_cards_away";
const PLAYER_SELECT = "id,name,team_code,team_name,active,deleted_at";
const ROSTER_SELECT = "championship,player_id,team_code,team_name,is_official";

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

const hasOwn = (body: OfficialExtrasPayload, key: keyof OfficialExtrasPayload) =>
  Object.prototype.hasOwnProperty.call(body, key);

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

const readOptionalBoolean = (value: unknown, label: string) => {
  if (value === undefined || value === null || typeof value === "boolean") return value;
  throw new Error(`${label} invalido.`);
};

const readOptionalUuid = (value: unknown, label: string) => {
  if (value === undefined || value === null) return value;
  if (isUuid(value)) return value;
  throw new Error(`${label} invalido.`);
};

const readOptionalCardCount = (value: unknown, label: string) => {
  if (value === undefined || value === null) return value;
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) return value;
  throw new Error(`${label} invalido.`);
};

const loadMatch = async (supabase: SupabaseClient, matchId: string) => {
  const matchWithCodes = await supabase
    .from("matches")
    .select(MATCH_SELECT_WITH_CODES)
    .eq("id", matchId)
    .maybeSingle();

  if (!matchWithCodes.error) {
    return matchWithCodes.data as MatchExtrasRow | null;
  }

  if (!missingTeamCodeColumn(matchWithCodes.error)) {
    throw matchWithCodes.error;
  }

  const matchWithoutCodes = await supabase
    .from("matches")
    .select(MATCH_SELECT_BASE)
    .eq("id", matchId)
    .maybeSingle();

  if (matchWithoutCodes.error) throw matchWithoutCodes.error;
  return matchWithoutCodes.data as MatchExtrasRow | null;
};

const playerBelongsToMatchTeams = (
  player: PlayerRow,
  roster: CompetitionRosterRow,
  match: MatchExtrasRow,
) => {
  const homeTeamCode = match.home_team_code ?? normalizeTeamCode(normalizeTeamNameWithAliases(match.home_team));
  const awayTeamCode = match.away_team_code ?? normalizeTeamCode(normalizeTeamNameWithAliases(match.away_team));
  const matchTeamIdentifiers = [
    ...teamIdentifiersFor(match.home_team, homeTeamCode),
    ...teamIdentifiersFor(match.away_team, awayTeamCode),
  ];
  const playerIdentifiers = uniqueStrings([
    player.team_name,
    player.team_code,
    roster.team_name,
    roster.team_code,
    normalizeTeamCode(player.team_name),
    player.team_code ? normalizeTeamCode(player.team_code) : null,
    roster.team_name ? normalizeTeamCode(roster.team_name) : null,
    roster.team_code ? normalizeTeamCode(roster.team_code) : null,
  ]).map(normalizeComparableTeam);

  return playerIdentifiers.some((identifier) => matchTeamIdentifiers.includes(identifier));
};

const validateOfficialRosterPlayer = async (
  supabase: SupabaseClient,
  match: MatchExtrasRow,
  playerId: string,
) => {
  const { data: player, error: playerError } = await supabase
    .from("players")
    .select(PLAYER_SELECT)
    .eq("id", playerId)
    .maybeSingle();
  if (playerError) throw playerError;

  const playerRow = player as PlayerRow | null;
  if (!playerRow || !playerRow.active || playerRow.deleted_at) {
    return { ok: false as const, error: "Jogador invalido." };
  }

  const { data: roster, error: rosterError } = await supabase
    .from("competition_rosters")
    .select(ROSTER_SELECT)
    .eq("championship", match.championship ?? "")
    .eq("player_id", playerRow.id)
    .eq("is_official", true)
    .maybeSingle();
  if (rosterError) throw rosterError;

  const rosterRow = roster as CompetitionRosterRow | null;
  if (!rosterRow) {
    return { ok: false as const, error: "Jogador nao pertence ao elenco oficial desta competicao." };
  }

  if (!playerBelongsToMatchTeams(playerRow, rosterRow, match)) {
    return { ok: false as const, error: "Jogador nao pertence aos times desta partida." };
  }

  return { ok: true as const, player: playerRow, roster: rosterRow };
};

export async function POST(request: NextRequest, context: RouteContext) {
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

    const body = await request.json().catch(() => ({})) as OfficialExtrasPayload;
    const firstGoalNoGoals = readOptionalBoolean(body.first_goal_no_goals, "first_goal_no_goals");
    const firstGoalScorerId = readOptionalUuid(body.first_goal_scorer_id, "first_goal_scorer_id");
    const manOfMatchId = readOptionalUuid(body.man_of_match_id, "man_of_match_id");
    const redCardHappened = readOptionalBoolean(body.red_card_happened, "red_card_happened");
    const redCardsHome = readOptionalCardCount(body.red_cards_home, "red_cards_home");
    const redCardsAway = readOptionalCardCount(body.red_cards_away, "red_cards_away");

    const serviceSupabase = createServiceSupabaseClient();
    const match = await loadMatch(serviceSupabase, matchId);
    if (!match) {
      return NextResponse.json({ error: "Partida nao encontrada." }, { status: 404 });
    }

    const updates: MatchExtrasUpdate = {};

    if (firstGoalNoGoals === true) {
      updates.first_goal_no_goals = true;
      updates.first_goal_scorer = null;
      updates.first_goal_scorer_id = null;
    } else if (hasOwn(body, "first_goal_scorer_id")) {
      if (firstGoalScorerId === null) {
        updates.first_goal_no_goals = false;
        updates.first_goal_scorer = null;
        updates.first_goal_scorer_id = null;
      } else if (firstGoalScorerId) {
        const playerResult = await validateOfficialRosterPlayer(serviceSupabase, match, firstGoalScorerId);
        if (!playerResult.ok) {
          return NextResponse.json({ error: playerResult.error }, { status: 400 });
        }

        updates.first_goal_no_goals = false;
        updates.first_goal_scorer = playerResult.player.name;
        updates.first_goal_scorer_id = playerResult.player.id;
      }
    } else if (hasOwn(body, "first_goal_no_goals")) {
      updates.first_goal_no_goals = firstGoalNoGoals === null ? null : false;
    }

    if (hasOwn(body, "man_of_match_id")) {
      if (manOfMatchId === null) {
        updates.man_of_match = null;
        updates.man_of_match_id = null;
      } else if (manOfMatchId) {
        const playerResult = await validateOfficialRosterPlayer(serviceSupabase, match, manOfMatchId);
        if (!playerResult.ok) {
          return NextResponse.json({ error: playerResult.error }, { status: 400 });
        }

        updates.man_of_match = playerResult.player.name;
        updates.man_of_match_id = playerResult.player.id;
      }
    }

    if (hasOwn(body, "red_card_happened")) updates.red_card_happened = redCardHappened;
    if (hasOwn(body, "red_cards_home")) updates.red_cards_home = redCardsHome;
    if (hasOwn(body, "red_cards_away")) updates.red_cards_away = redCardsAway;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({
        match: {
          first_goal_no_goals: match.first_goal_no_goals,
          first_goal_scorer: match.first_goal_scorer,
          first_goal_scorer_id: match.first_goal_scorer_id,
          id: match.id,
          man_of_match: match.man_of_match,
          man_of_match_id: match.man_of_match_id,
          red_card_happened: match.red_card_happened,
          red_cards_away: match.red_cards_away,
          red_cards_home: match.red_cards_home,
        },
        ok: true,
      });
    }

    const { data: updatedMatch, error: updateError } = await serviceSupabase
      .from("matches")
      .update(updates)
      .eq("id", match.id)
      .select("id,first_goal_scorer_id,first_goal_scorer,first_goal_no_goals,man_of_match_id,man_of_match,red_card_happened,red_cards_home,red_cards_away")
      .single();
    if (updateError) throw updateError;

    return NextResponse.json({
      match: updatedMatch,
      ok: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao salvar extras oficiais.";
    const status = message.endsWith("invalido.") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
