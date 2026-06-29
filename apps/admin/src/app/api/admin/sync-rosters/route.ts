import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  RosterProviderError,
  checkApiFootballStatus,
  fetchTeamRoster,
  getTeamsNeedingRoster,
  inferPositionGroup,
  type ApiFootballStatusDebug,
  type ProviderRosterPlayer,
  type TeamNeedingRoster,
} from "@/server/roster-provider";
import { createServiceSupabaseClient } from "@/server/sync-results";

type SyncRostersPayload = {
  championship?: unknown;
  team_codes?: unknown;
};

type PlayerRow = {
  active?: boolean | null;
  deleted_at?: string | null;
  id: string;
  name: string;
  position?: string | null;
  provider_external_id?: string | null;
  source?: string | null;
  team_code?: string | null;
  team_name: string;
};

type PlayerInsertRow = {
  active: true;
  name: string;
  position: string | null;
  provider_external_id: string | null;
  source: string;
  team_code: string;
  team_name: string;
};

type PlayerUpdateRow = Partial<Pick<
  PlayerRow,
  "active" | "position" | "provider_external_id" | "source" | "team_code" | "team_name"
>>;

type SyncedPlayer = {
  player: PlayerRow;
  providerPlayer: ProviderRosterPlayer;
};

type TeamSyncResult = {
  playersFetched: number;
  playersUpserted: number;
  rostersUpserted: number;
  source: string | null;
  team_code: string;
  team_name: string;
  warnings: string[];
};

type SyncRostersDebug = {
  apiFootballStatus?: ApiFootballStatusDebug | null;
};

const PLAYER_SELECT = "id,name,team_code,team_name,position,active,deleted_at,provider_external_id,source";
const DEFAULT_CHAMPIONSHIP = "world_cup_2026";

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

const errorResponse = (message: string, status = 400) =>
  NextResponse.json({ error: message, ok: false }, { status });

const readOptionalString = (value: unknown) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
};

const normalizeText = (value?: string | null) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeCode = (value?: string | null) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");

const uniqueWarnings = (warnings: string[]) =>
  Array.from(new Set(warnings.map((warning) => warning.trim()).filter(Boolean)));

const hasProviderErrors = (errors: unknown) => {
  if (!errors) return false;
  if (Array.isArray(errors)) return errors.length > 0;
  if (typeof errors === "object") return Object.keys(errors as Record<string, unknown>).length > 0;
  if (typeof errors === "string") return errors.trim().length > 0;
  return true;
};

const readTeamCodes = (value: unknown) => {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value)) throw new Error("team_codes precisa ser um array.");

  const codes = uniqueWarnings(value.flatMap((item) => {
    const code = readOptionalString(item);
    return code ? [normalizeCode(code)] : [];
  }));

  return codes.length ? codes : null;
};

const exactNameMatch = (left?: string | null, right?: string | null) =>
  normalizeText(left) === normalizeText(right);

const exactTeamNameMatch = (left?: string | null, right?: string | null) =>
  normalizeText(left) === normalizeText(right);

const findByProviderIdentity = async (
  supabase: SupabaseClient,
  providerPlayer: ProviderRosterPlayer,
  warnings: string[],
) => {
  if (!providerPlayer.external_id) return null;

  const { data, error } = await supabase
    .from("players")
    .select(PLAYER_SELECT)
    .eq("provider_external_id", providerPlayer.external_id)
    .eq("source", providerPlayer.source)
    .limit(2);
  if (error) throw error;

  const matches = (data ?? []) as PlayerRow[];
  const activeMatches = matches.filter((player) => !player.deleted_at);
  if (activeMatches.length > 1) {
    warnings.push(`Mais de um jogador encontrado por provider para ${providerPlayer.name}; usando o primeiro.`);
  }

  if (activeMatches[0]) return activeMatches[0];
  if (matches.length > 0) {
    warnings.push(`Jogador ${providerPlayer.name} existe com deleted_at; nao reativei automaticamente.`);
  }

  return null;
};

const findByNameAndTeamCode = async (
  supabase: SupabaseClient,
  providerPlayer: ProviderRosterPlayer,
  warnings: string[],
) => {
  const { data, error } = await supabase
    .from("players")
    .select(PLAYER_SELECT)
    .ilike("team_code", providerPlayer.team_code);
  if (error) throw error;

  const matches = ((data ?? []) as PlayerRow[]).filter((player) => exactNameMatch(player.name, providerPlayer.name));
  const activeMatches = matches.filter((player) => !player.deleted_at);
  if (activeMatches.length > 1) {
    warnings.push(`Mais de um jogador encontrado para ${providerPlayer.name}/${providerPlayer.team_code}; usando o primeiro.`);
  }

  if (activeMatches[0]) return activeMatches[0];
  if (matches.length > 0) {
    warnings.push(`Jogador ${providerPlayer.name} (${providerPlayer.team_code}) existe com deleted_at; nao reativei automaticamente.`);
  }

  return null;
};

const findByNameAndTeamName = async (
  supabase: SupabaseClient,
  providerPlayer: ProviderRosterPlayer,
  warnings: string[],
) => {
  const { data, error } = await supabase
    .from("players")
    .select(PLAYER_SELECT)
    .ilike("team_name", providerPlayer.team_name);
  if (error) throw error;

  const matches = ((data ?? []) as PlayerRow[])
    .filter((player) =>
      exactNameMatch(player.name, providerPlayer.name)
      && exactTeamNameMatch(player.team_name, providerPlayer.team_name)
    );
  const activeMatches = matches.filter((player) => !player.deleted_at);
  if (activeMatches.length > 1) {
    warnings.push(`Mais de um jogador encontrado para ${providerPlayer.name}/${providerPlayer.team_name}; usando o primeiro.`);
  }

  if (activeMatches[0]) return activeMatches[0];
  if (matches.length > 0) {
    warnings.push(`Jogador ${providerPlayer.name} (${providerPlayer.team_name}) existe com deleted_at; nao reativei automaticamente.`);
  }

  return null;
};

const findExistingPlayer = async (
  supabase: SupabaseClient,
  providerPlayer: ProviderRosterPlayer,
  warnings: string[],
) => {
  const providerMatch = await findByProviderIdentity(supabase, providerPlayer, warnings);
  if (providerMatch) return providerMatch;

  const codeMatch = await findByNameAndTeamCode(supabase, providerPlayer, warnings);
  if (codeMatch) return codeMatch;

  return await findByNameAndTeamName(supabase, providerPlayer, warnings);
};

const playerUpdatesFor = (existing: PlayerRow, providerPlayer: ProviderRosterPlayer): PlayerUpdateRow => {
  const updates: PlayerUpdateRow = {};
  const position = providerPlayer.position ?? existing.position ?? null;

  if (!existing.active) updates.active = true;
  if (position !== existing.position) updates.position = position;
  if (providerPlayer.team_code && providerPlayer.team_code !== existing.team_code) updates.team_code = providerPlayer.team_code;
  if (providerPlayer.team_name && providerPlayer.team_name !== existing.team_name) updates.team_name = providerPlayer.team_name;
  if (providerPlayer.external_id && !existing.provider_external_id) {
    updates.provider_external_id = providerPlayer.external_id;
    updates.source = providerPlayer.source;
  } else if (!existing.source) {
    updates.source = providerPlayer.source;
  }

  return updates;
};

const upsertPlayer = async (
  supabase: SupabaseClient,
  providerPlayer: ProviderRosterPlayer,
  warnings: string[],
) => {
  const existing = await findExistingPlayer(supabase, providerPlayer, warnings);

  if (existing) {
    const updates = playerUpdatesFor(existing, providerPlayer);
    if (Object.keys(updates).length === 0) return existing;

    const { data, error } = await supabase
      .from("players")
      .update(updates)
      .eq("id", existing.id)
      .select(PLAYER_SELECT)
      .single();
    if (error) throw error;
    return data as PlayerRow;
  }

  const insertRow: PlayerInsertRow = {
    active: true,
    name: providerPlayer.name,
    position: providerPlayer.position,
    provider_external_id: providerPlayer.external_id,
    source: providerPlayer.source,
    team_code: providerPlayer.team_code,
    team_name: providerPlayer.team_name,
  };

  const { data, error } = await supabase
    .from("players")
    .insert(insertRow)
    .select(PLAYER_SELECT)
    .single();
  if (error) throw error;
  return data as PlayerRow;
};

const upsertCompetitionRosters = async (
  supabase: SupabaseClient,
  championship: string,
  syncedPlayers: SyncedPlayer[],
) => {
  if (syncedPlayers.length === 0) return 0;

  const now = new Date().toISOString();
  const rows = syncedPlayers.map(({ player, providerPlayer }) => {
    const positionGroup = providerPlayer.is_reserve
      ? "RS"
      : providerPlayer.position_group ?? inferPositionGroup(providerPlayer.position);

    return {
      championship,
      is_official: true,
      is_reserve: Boolean(providerPlayer.is_reserve || positionGroup === "RS"),
      player_id: player.id,
      position: providerPlayer.position ?? player.position ?? null,
      position_group: positionGroup,
      roster_order: providerPlayer.roster_order,
      shirt_number: providerPlayer.shirt_number,
      source: providerPlayer.source,
      team_code: providerPlayer.team_code,
      team_name: providerPlayer.team_name,
      updated_at: now,
    };
  });

  const { data, error } = await supabase
    .from("competition_rosters")
    .upsert(rows, { onConflict: "championship,player_id" })
    .select("player_id");
  if (error) throw error;

  return data?.length ?? 0;
};

const emptyTeamResult = (team: TeamNeedingRoster): TeamSyncResult => ({
  playersFetched: 0,
  playersUpserted: 0,
  rostersUpserted: 0,
  source: null,
  team_code: team.team_code,
  team_name: team.team_name,
  warnings: [],
});

const syncTeamRoster = async (
  supabase: SupabaseClient,
  championship: string,
  team: TeamNeedingRoster,
) => {
  const result = emptyTeamResult(team);

  let providerPlayers: ProviderRosterPlayer[] = [];
  try {
    providerPlayers = await fetchTeamRoster({
      championship,
      providerTeamId: team.provider_team_id,
      teamCode: team.team_code,
      teamName: team.team_name,
    });
  } catch (error) {
    if (error instanceof RosterProviderError) {
      result.warnings.push(error.message, ...error.warnings);
      return result;
    }

    result.warnings.push(error instanceof Error ? error.message : `Falha ao sincronizar ${team.team_name}.`);
    return result;
  }

  result.playersFetched = providerPlayers.length;
  result.source = providerPlayers[0]?.source ?? null;

  if (providerPlayers.length === 0) {
    result.warnings.push(`Provider nao retornou elenco para ${team.team_name} (${team.team_code}).`);
    return result;
  }

  const syncedPlayers: SyncedPlayer[] = [];
  for (const providerPlayer of providerPlayers) {
    try {
      const normalizedProviderPlayer: ProviderRosterPlayer = {
        ...providerPlayer,
        position_group: providerPlayer.position_group ?? inferPositionGroup(providerPlayer.position),
      };
      const player = await upsertPlayer(supabase, normalizedProviderPlayer, result.warnings);
      syncedPlayers.push({ player, providerPlayer: normalizedProviderPlayer });
      result.playersUpserted += 1;
    } catch (error) {
      result.warnings.push(
        `Falha ao gravar jogador ${providerPlayer.name} (${team.team_code}): ${
          error instanceof Error ? error.message : "erro desconhecido"
        }.`,
      );
    }
  }

  if (syncedPlayers.length > 0) {
    try {
      result.rostersUpserted = await upsertCompetitionRosters(supabase, championship, syncedPlayers);
    } catch (error) {
      result.warnings.push(
        `Falha ao vincular roster de ${team.team_name}: ${error instanceof Error ? error.message : "erro desconhecido"}.`,
      );
    }
  }

  return {
    ...result,
    warnings: uniqueWarnings(result.warnings),
  };
};

export async function POST(request: NextRequest) {
  try {
    const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
    if (!accessToken) {
      return NextResponse.json({ error: "Token de autorizacao nao enviado." }, { status: 401 });
    }

    if (!await assertApprovedAdmin(accessToken)) {
      return NextResponse.json({ error: "Token invalido ou admin nao aprovado." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({})) as SyncRostersPayload;
    const championship = readOptionalString(body.championship) ?? DEFAULT_CHAMPIONSHIP;
    const teamCodes = readTeamCodes(body.team_codes);
    const supabase = createServiceSupabaseClient();
    const warnings: string[] = [];
    const debug: SyncRostersDebug = {};
    if (process.env.API_FOOTBALL_KEY) {
      try {
        const apiFootballStatus = await checkApiFootballStatus(process.env.API_FOOTBALL_KEY);
        debug.apiFootballStatus = apiFootballStatus;
        if (hasProviderErrors(apiFootballStatus?.errors)) {
          warnings.push(`API-Football errors (/status): ${JSON.stringify(apiFootballStatus?.errors)}`);
        }
      } catch {
        warnings.push("Nao foi possivel validar status da API-Football.");
      }
    }

    const teamsFromMatches = await getTeamsNeedingRoster(supabase, championship, warnings);
    const teams = teamCodes
      ? teamsFromMatches.filter((team) => teamCodes.includes(normalizeCode(team.team_code)))
      : teamsFromMatches;

    if (teamsFromMatches.length === 0) {
      warnings.push(`Nenhum time real encontrado em partidas de ${championship}.`);
    } else if (teamCodes && teams.length === 0) {
      warnings.push(`Nenhum dos team_codes solicitados foi encontrado em partidas de ${championship}.`);
    }

    const teamResults: TeamSyncResult[] = [];
    for (const team of teams) {
      const teamResult = await syncTeamRoster(supabase, championship, team);
      teamResults.push(teamResult);
      warnings.push(...teamResult.warnings.map((warning) => `${team.team_code}: ${warning}`));
    }

    const summary = {
      debug,
      globalWarnings: uniqueWarnings(warnings),
      playersFetched: teamResults.reduce((sum, team) => sum + team.playersFetched, 0),
      playersUpserted: teamResults.reduce((sum, team) => sum + team.playersUpserted, 0),
      rostersUpserted: teamResults.reduce((sum, team) => sum + team.rostersUpserted, 0),
      teamsChecked: teams.length,
      teamsFailed: teamResults.filter((team) => team.playersFetched === 0 || team.rostersUpserted === 0).length,
      teamsSynced: teamResults.filter((team) => team.rostersUpserted > 0).length,
      warnings: uniqueWarnings(warnings),
    };

    if (summary.teamsChecked > 0 && summary.playersFetched === 0) {
      summary.globalWarnings.push(
        "Times encontrados, mas nenhum elenco retornou do provider. A API-Football respondeu sem teamId/squad para estas selecoes e o ESPN nao retornou roster confiavel.",
      );
      summary.warnings = uniqueWarnings([...summary.warnings, ...summary.globalWarnings]);
    }

    return NextResponse.json({
      championship,
      ok: true,
      summary,
      teams: teamResults,
    });
  } catch (error) {
    if (error instanceof Error && /team_codes/.test(error.message)) {
      return errorResponse(error.message);
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao sincronizar elencos.", ok: false },
      { status: 500 },
    );
  }
}
