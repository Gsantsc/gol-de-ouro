import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServiceSupabaseClient } from "@/server/sync-results";

type ImportPlayerInput = {
  name?: unknown;
  notes?: unknown;
  player_id?: unknown;
  team_code?: unknown;
  team_name?: unknown;
};

type ImportPayload = {
  championship?: unknown;
  dryRun?: unknown;
  players?: unknown;
  source?: unknown;
};

type PlayerRow = {
  active?: boolean | null;
  deleted_at?: string | null;
  id: string;
  name: string;
  team_code?: string | null;
  team_name: string;
};

type ValidPlayer = {
  input: ImportPlayerInput;
  notes: string | null;
  player: PlayerRow;
  roster: {
    championship: string;
    is_official: true;
    player_id: string;
    source: string | null;
    team_code: string | null;
    team_name: string | null;
  };
};

type ImportErrorReason = "not_found" | "ambiguous" | "inactive" | "invalid_team";

type ImportError = {
  input: ImportPlayerInput;
  reason: ImportErrorReason;
};

type ImportSummary = {
  ambiguous: number;
  inactive: number;
  invalidTeam: number;
  notFound: number;
  received: number;
  upserted: number;
  valid: number;
};

const PLAYER_SELECT = "id,name,team_code,team_name,active,deleted_at";

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
    .trim();

const normalizeTeamCode = (value?: string | null) =>
  normalizeText(value)
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const uniqueStrings = (values: Array<string | null | undefined>) =>
  Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]));

const teamIdentifiers = (teamCode?: string | null, teamName?: string | null) =>
  uniqueStrings([
    teamCode,
    teamName,
    teamCode ? normalizeTeamCode(teamCode) : null,
    teamName ? normalizeTeamCode(teamName) : null,
  ]).map((value) => normalizeText(value.replace(/[_-]+/g, " ")));

const hasCompatibleTeam = (player: PlayerRow, input: ImportPlayerInput) => {
  const inputTeamCode = readOptionalString(input.team_code);
  const inputTeamName = readOptionalString(input.team_name);
  const inputIdentifiers = teamIdentifiers(inputTeamCode, inputTeamName);
  if (inputIdentifiers.length === 0) return false;

  const playerIdentifiers = teamIdentifiers(player.team_code, player.team_name);
  return inputIdentifiers.some((identifier) => playerIdentifiers.includes(identifier));
};

const errorResponse = (message: string, status = 400) =>
  NextResponse.json({ error: message, ok: false }, { status });

const emptySummary = (received: number): ImportSummary => ({
  ambiguous: 0,
  inactive: 0,
  invalidTeam: 0,
  notFound: 0,
  received,
  upserted: 0,
  valid: 0,
});

const addError = (summary: ImportSummary, errors: ImportError[], input: ImportPlayerInput, reason: ImportErrorReason) => {
  errors.push({ input, reason });
  if (reason === "not_found") summary.notFound += 1;
  else if (reason === "invalid_team") summary.invalidTeam += 1;
  else summary[reason] += 1;
};

const buildValidPlayer = (
  championship: string,
  source: string | null,
  input: ImportPlayerInput,
  player: PlayerRow,
): ValidPlayer => {
  const inputTeamCode = readOptionalString(input.team_code);
  const inputTeamName = readOptionalString(input.team_name);

  return {
    input,
    notes: readOptionalString(input.notes),
    player,
    roster: {
      championship,
      is_official: true,
      player_id: player.id,
      source,
      team_code: inputTeamCode ?? player.team_code ?? null,
      team_name: inputTeamName ?? player.team_name,
    },
  };
};

const validateById = async (
  supabase: SupabaseClient,
  championship: string,
  source: string | null,
  input: ImportPlayerInput,
) => {
  if (!isUuid(input.player_id)) {
    return { ok: false as const, reason: "not_found" as const };
  }

  const { data, error } = await supabase
    .from("players")
    .select(PLAYER_SELECT)
    .eq("id", input.player_id)
    .maybeSingle();
  if (error) throw error;

  const player = data as PlayerRow | null;
  if (!player || player.deleted_at) return { ok: false as const, reason: "not_found" as const };
  if (!player.active) return { ok: false as const, reason: "inactive" as const };

  const providedTeam = readOptionalString(input.team_code) || readOptionalString(input.team_name);
  if (providedTeam && !hasCompatibleTeam(player, input)) {
    return { ok: false as const, reason: "invalid_team" as const };
  }

  return { ok: true as const, validPlayer: buildValidPlayer(championship, source, input, player) };
};

const validateByNameAndTeam = async (
  supabase: SupabaseClient,
  championship: string,
  source: string | null,
  input: ImportPlayerInput,
) => {
  const name = readOptionalString(input.name);
  const inputTeamCode = readOptionalString(input.team_code);
  const inputTeamName = readOptionalString(input.team_name);
  if (!name) return { ok: false as const, reason: "not_found" as const };
  if (!inputTeamCode && !inputTeamName) return { ok: false as const, reason: "invalid_team" as const };

  const { data, error } = await supabase
    .from("players")
    .select(PLAYER_SELECT)
    .ilike("name", name);
  if (error) throw error;

  const nameMatches = ((data ?? []) as PlayerRow[])
    .filter((player) => normalizeText(player.name) === normalizeText(name) && !player.deleted_at);
  const teamMatches = nameMatches.filter((player) => hasCompatibleTeam(player, input));

  if (teamMatches.length === 0) {
    return { ok: false as const, reason: nameMatches.length > 0 ? "invalid_team" as const : "not_found" as const };
  }
  if (teamMatches.length > 1) return { ok: false as const, reason: "ambiguous" as const };
  if (!teamMatches[0].active) return { ok: false as const, reason: "inactive" as const };

  return { ok: true as const, validPlayer: buildValidPlayer(championship, source, input, teamMatches[0]) };
};

const validateInput = async (
  supabase: SupabaseClient,
  championship: string,
  source: string | null,
  input: ImportPlayerInput,
) => {
  if (readOptionalString(input.player_id)) {
    return validateById(supabase, championship, source, input);
  }

  return validateByNameAndTeam(supabase, championship, source, input);
};

const toResponsePlayer = (validPlayer: ValidPlayer) => ({
  championship: validPlayer.roster.championship,
  id: validPlayer.player.id,
  name: validPlayer.player.name,
  source: validPlayer.roster.source,
  team_code: validPlayer.roster.team_code,
  team_name: validPlayer.roster.team_name,
});

export async function POST(request: NextRequest) {
  try {
    const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
    if (!accessToken) {
      return NextResponse.json({ error: "Token de autorizacao nao enviado." }, { status: 401 });
    }

    if (!await assertApprovedAdmin(accessToken)) {
      return NextResponse.json({ error: "Token invalido ou admin nao aprovado." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({})) as ImportPayload;
    const championship = readOptionalString(body.championship);
    if (!championship) return errorResponse("championship e obrigatorio.");
    if (!Array.isArray(body.players)) return errorResponse("players precisa ser um array.");

    const dryRun = body.dryRun !== false;
    const source = readOptionalString(body.source);
    const players = body.players as ImportPlayerInput[];
    const summary = emptySummary(players.length);
    const validPlayers: ValidPlayer[] = [];
    const errors: ImportError[] = [];
    const supabase = createServiceSupabaseClient();

    for (const input of players) {
      if (!input || typeof input !== "object" || Array.isArray(input)) {
        addError(summary, errors, {}, "not_found");
        continue;
      }

      const validation = await validateInput(supabase, championship, source, input);
      if (!validation.ok) {
        addError(summary, errors, input, validation.reason);
        continue;
      }

      validPlayers.push(validation.validPlayer);
      summary.valid += 1;
    }

    if (!dryRun && errors.length > 0) {
      return NextResponse.json({
        dryRun,
        errors,
        ok: false,
        summary,
        validPlayers: validPlayers.map(toResponsePlayer),
      }, { status: 400 });
    }

    if (!dryRun && validPlayers.length > 0) {
      const now = new Date().toISOString();
      const rows = validPlayers.map((validPlayer) => ({
        championship: validPlayer.roster.championship,
        is_official: true,
        notes: validPlayer.notes,
        player_id: validPlayer.roster.player_id,
        source: validPlayer.roster.source,
        team_code: validPlayer.roster.team_code,
        team_name: validPlayer.roster.team_name,
        updated_at: now,
      }));

      const { error: upsertError } = await supabase
        .from("competition_rosters")
        .upsert(rows, { onConflict: "championship,player_id" });
      if (upsertError) throw upsertError;

      summary.upserted = rows.length;
    }

    return NextResponse.json({
      dryRun,
      errors,
      ok: true,
      summary,
      validPlayers: validPlayers.map(toResponsePlayer),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao importar elenco oficial.", ok: false },
      { status: 500 },
    );
  }
}
