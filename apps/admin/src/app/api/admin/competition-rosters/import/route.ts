import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServiceSupabaseClient } from "@/server/sync-results";

type PositionGroup = "GOL" | "DEF" | "MEI" | "ATA" | "RS";

type ImportPlayerInput = {
  is_reserve?: unknown;
  name?: unknown;
  notes?: unknown;
  player_id?: unknown;
  position?: unknown;
  position_group?: unknown;
  roster_order?: unknown;
  shirt_number?: unknown;
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
  position?: string | null;
  team_code?: string | null;
  team_name: string;
};

type PlayerInsertRow = {
  active: true;
  name: string;
  position: string | null;
  source: string;
  team_code: string;
  team_name: string;
};

type PlayerUpdateRow = Partial<Pick<PlayerRow, "active" | "position" | "team_code" | "team_name">>;

type RosterDraft = {
  championship: string;
  is_official: true;
  is_reserve: boolean;
  notes: string | null;
  player_id: string | null;
  position: string | null;
  position_group: PositionGroup | null;
  roster_order: number | null;
  shirt_number: number | null;
  source: string | null;
  team_code: string | null;
  team_name: string | null;
};

type ValidPlayer = {
  createPlayer?: PlayerInsertRow;
  input: ImportPlayerInput;
  player: PlayerRow | null;
  playerUpdates?: PlayerUpdateRow;
  resolution: "create" | "matched";
  roster: RosterDraft;
};

type ImportErrorReason =
  | "ambiguous"
  | "duplicate_payload"
  | "invalid_number"
  | "invalid_player"
  | "invalid_position"
  | "invalid_team"
  | "missing_required"
  | "not_found";

type ImportError = {
  input: ImportPlayerInput;
  message: string;
  reason: ImportErrorReason;
};

type ImportSummary = {
  errors: number;
  playersMatched: number;
  playersToCreate: number;
  received: number;
  rostersToUpsert: number;
  valid: number;
};

const PLAYER_SELECT = "id,name,team_code,team_name,position,active,deleted_at";
const POSITION_GROUPS = new Set<PositionGroup>(["GOL", "DEF", "MEI", "ATA", "RS"]);

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

const readOptionalBoolean = (value: unknown, label: string) => {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "sim", "yes"].includes(normalized)) return true;
    if (["false", "0", "nao", "no"].includes(normalized)) return false;
  }

  throw new Error(`${label} invalido.`);
};

const readOptionalInteger = (value: unknown, label: string, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${label} invalido.`);
  }

  return parsed;
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
  if (inputIdentifiers.length === 0) return true;

  const playerIdentifiers = teamIdentifiers(player.team_code, player.team_name);
  return inputIdentifiers.some((identifier) => playerIdentifiers.includes(identifier));
};

const normalizePositionGroup = (value?: string | null) => {
  if (!value) return null;
  const normalized = normalizeText(value).toUpperCase();
  return POSITION_GROUPS.has(normalized as PositionGroup) ? normalized as PositionGroup : null;
};

const inferPositionGroup = (position?: string | null) => {
  const normalized = normalizeText(position);
  if (!normalized) return null;
  if (/(goleir|goalkeeper|\bgk\b)/i.test(normalized)) return "GOL";
  if (/(zagueir|lateral|defensor|defender|defesa|back)/i.test(normalized)) return "DEF";
  if (/(meia|meio|volante|midfield|midfielder)/i.test(normalized)) return "MEI";
  if (/(atacante|ponta|forward|striker|winger|ataque)/i.test(normalized)) return "ATA";
  if (/(reserva|reserve|\brs\b)/i.test(normalized)) return "RS";
  return null;
};

const readPositionMetadata = (input: ImportPlayerInput, player?: PlayerRow | null): {
  isReserve: boolean;
  position: string | null;
  positionGroup: PositionGroup | null;
  rosterOrder: number | null;
  shirtNumber: number | null;
} => {
  const rawPositionGroup = readOptionalString(input.position_group);
  const inputPosition = readOptionalString(input.position);
  const position = inputPosition ?? player?.position ?? null;
  const explicitGroup = normalizePositionGroup(rawPositionGroup);

  if (rawPositionGroup && !explicitGroup) {
    throw new Error("position_group invalido.");
  }

  const inferredGroup = explicitGroup ?? inferPositionGroup(position);
  const explicitReserve = readOptionalBoolean(input.is_reserve, "is_reserve") ?? false;
  const isReserve = explicitReserve || inferredGroup === "RS";
  const positionGroup = isReserve ? "RS" : inferredGroup;
  const shirtNumber = readOptionalInteger(input.shirt_number, "shirt_number", 1, 99);
  const rosterOrder = readOptionalInteger(input.roster_order, "roster_order", 0);

  if (!positionGroup && !position) {
    throw new Error("position_group ou position e obrigatorio.");
  }

  return {
    isReserve,
    position,
    positionGroup,
    rosterOrder,
    shirtNumber,
  };
};

const errorResponse = (message: string, status = 400) =>
  NextResponse.json({ error: message, ok: false }, { status });

const emptySummary = (received: number): ImportSummary => ({
  errors: 0,
  playersMatched: 0,
  playersToCreate: 0,
  received,
  rostersToUpsert: 0,
  valid: 0,
});

const addError = (
  summary: ImportSummary,
  errors: ImportError[],
  input: ImportPlayerInput,
  reason: ImportErrorReason,
  message: string,
) => {
  errors.push({ input, message, reason });
  summary.errors += 1;
};

const errorReasonForMessage = (message: string): ImportErrorReason => {
  if (/position/i.test(message)) return "invalid_position";
  if (/shirt_number|roster_order/i.test(message)) return "invalid_number";
  if (/team/i.test(message)) return "invalid_team";
  return "missing_required";
};

const createRosterDraft = (
  championship: string,
  source: string | null,
  input: ImportPlayerInput,
  player: PlayerRow | null,
): RosterDraft => {
  const inputTeamCode = readOptionalString(input.team_code);
  const inputTeamName = readOptionalString(input.team_name);
  const positionMetadata = readPositionMetadata(input, player);

  return {
    championship,
    is_official: true,
    is_reserve: positionMetadata.isReserve,
    notes: readOptionalString(input.notes),
    player_id: player?.id ?? null,
    position: positionMetadata.position,
    position_group: positionMetadata.positionGroup,
    roster_order: positionMetadata.rosterOrder,
    shirt_number: positionMetadata.shirtNumber,
    source,
    team_code: inputTeamCode ?? player?.team_code ?? null,
    team_name: inputTeamName ?? player?.team_name ?? null,
  };
};

const buildPlayerUpdates = (player: PlayerRow, input: ImportPlayerInput, roster: RosterDraft): PlayerUpdateRow => {
  const updates: PlayerUpdateRow = {};
  const inputPosition = readOptionalString(input.position);

  if (!player.active) updates.active = true;
  if (inputPosition && player.position !== inputPosition) updates.position = inputPosition;
  if (roster.team_code && player.team_code !== roster.team_code) updates.team_code = roster.team_code;
  if (roster.team_name && player.team_name !== roster.team_name) updates.team_name = roster.team_name;

  return updates;
};

const toInsertRow = (input: ImportPlayerInput, roster: RosterDraft, source: string | null): PlayerInsertRow => {
  const name = readOptionalString(input.name);
  const teamCode = roster.team_code ?? (roster.team_name ? normalizeTeamCode(roster.team_name) : null);
  const teamName = roster.team_name ?? teamCode;

  if (!name) throw new Error("name e obrigatorio.");
  if (!teamCode || !teamName) throw new Error("team_code ou team_name e obrigatorio.");
  if (!roster.position_group && !roster.position) throw new Error("position_group ou position e obrigatorio.");

  return {
    active: true,
    name,
    position: roster.position,
    source: source ?? "manual-roster-import",
    team_code: teamCode,
    team_name: teamName,
  };
};

const validateById = async (
  supabase: SupabaseClient,
  championship: string,
  source: string | null,
  input: ImportPlayerInput,
) => {
  if (!isUuid(input.player_id)) {
    return { ok: false as const, reason: "not_found" as const, message: "player_id nao encontrado." };
  }

  const { data, error } = await supabase
    .from("players")
    .select(PLAYER_SELECT)
    .eq("id", input.player_id)
    .maybeSingle();
  if (error) throw error;

  const player = data as PlayerRow | null;
  if (!player || player.deleted_at) {
    return { ok: false as const, reason: "not_found" as const, message: "Jogador nao encontrado." };
  }

  if (!hasCompatibleTeam(player, input)) {
    return { ok: false as const, reason: "invalid_team" as const, message: "Time do jogador nao confere com o payload." };
  }

  const roster = createRosterDraft(championship, source, input, player);
  const playerUpdates = buildPlayerUpdates(player, input, roster);

  return {
    ok: true as const,
    validPlayer: {
      input,
      player,
      playerUpdates,
      resolution: "matched" as const,
      roster,
    },
  };
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
  if (!name) return { ok: false as const, reason: "missing_required" as const, message: "name e obrigatorio." };
  if (!inputTeamCode && !inputTeamName) {
    return { ok: false as const, reason: "invalid_team" as const, message: "team_code ou team_name e obrigatorio." };
  }

  const { data, error } = await supabase
    .from("players")
    .select(PLAYER_SELECT)
    .ilike("name", name);
  if (error) throw error;

  const nameMatches = ((data ?? []) as PlayerRow[])
    .filter((player) => normalizeText(player.name) === normalizeText(name) && !player.deleted_at);
  const teamMatches = nameMatches.filter((player) => hasCompatibleTeam(player, input));

  if (teamMatches.length > 1) {
    return { ok: false as const, reason: "ambiguous" as const, message: "Mais de um jogador encontrado para nome e time." };
  }

  if (teamMatches.length === 1) {
    const player = teamMatches[0];
    const roster = createRosterDraft(championship, source, input, player);
    const playerUpdates = buildPlayerUpdates(player, input, roster);

    return {
      ok: true as const,
      validPlayer: {
        input,
        player,
        playerUpdates,
        resolution: "matched" as const,
        roster,
      },
    };
  }

  const roster = createRosterDraft(championship, source, input, null);
  const createPlayer = toInsertRow(input, roster, source);

  return {
    ok: true as const,
    validPlayer: {
      createPlayer,
      input,
      player: null,
      resolution: "create" as const,
      roster: {
        ...roster,
        team_code: createPlayer.team_code,
        team_name: createPlayer.team_name,
      },
    },
  };
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

const payloadKeyFor = (validPlayer: ValidPlayer) => {
  if (validPlayer.player?.id) return `player:${validPlayer.player.id}`;

  const name = readOptionalString(validPlayer.input.name);
  const teamCode = validPlayer.createPlayer?.team_code ?? validPlayer.roster.team_code;
  return `create:${normalizeTeamCode(teamCode)}:${normalizeText(name)}`;
};

const toResponsePlayer = (validPlayer: ValidPlayer) => ({
  action: validPlayer.resolution,
  championship: validPlayer.roster.championship,
  id: validPlayer.player?.id ?? null,
  is_reserve: validPlayer.roster.is_reserve,
  name: validPlayer.player?.name ?? readOptionalString(validPlayer.input.name),
  player_id: validPlayer.player?.id ?? null,
  position: validPlayer.roster.position,
  position_group: validPlayer.roster.position_group,
  roster_order: validPlayer.roster.roster_order,
  shirt_number: validPlayer.roster.shirt_number,
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
    const seenPayloadKeys = new Set<string>();
    const supabase = createServiceSupabaseClient();

    for (const input of players) {
      if (!input || typeof input !== "object" || Array.isArray(input)) {
        addError(summary, errors, {}, "missing_required", "Item de player invalido.");
        continue;
      }

      try {
        const validation = await validateInput(supabase, championship, source, input);
        if (!validation.ok) {
          addError(summary, errors, input, validation.reason, validation.message);
          continue;
        }

        const payloadKey = payloadKeyFor(validation.validPlayer);
        if (seenPayloadKeys.has(payloadKey)) {
          addError(summary, errors, input, "duplicate_payload", "Jogador duplicado no payload.");
          continue;
        }
        seenPayloadKeys.add(payloadKey);

        validPlayers.push(validation.validPlayer);
        summary.valid += 1;
        summary.rostersToUpsert += 1;
        if (validation.validPlayer.resolution === "create") summary.playersToCreate += 1;
        else summary.playersMatched += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Player invalido.";
        addError(summary, errors, input, errorReasonForMessage(message), message);
      }
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
      for (const validPlayer of validPlayers) {
        if (validPlayer.resolution !== "matched" || !validPlayer.player?.id || !validPlayer.playerUpdates) continue;
        if (Object.keys(validPlayer.playerUpdates).length === 0) continue;

        const { data, error } = await supabase
          .from("players")
          .update(validPlayer.playerUpdates)
          .eq("id", validPlayer.player.id)
          .select(PLAYER_SELECT)
          .single();
        if (error) throw error;
        validPlayer.player = data as PlayerRow;
      }

      for (const validPlayer of validPlayers) {
        if (validPlayer.resolution !== "create" || !validPlayer.createPlayer) continue;

        const { data, error } = await supabase
          .from("players")
          .insert(validPlayer.createPlayer)
          .select(PLAYER_SELECT)
          .single();
        if (error) throw error;

        const createdPlayer = data as PlayerRow;
        validPlayer.player = createdPlayer;
        validPlayer.roster.player_id = createdPlayer.id;
      }

      const now = new Date().toISOString();
      const rows = validPlayers.flatMap((validPlayer) => {
        if (!validPlayer.player?.id) return [];
        return [{
          championship: validPlayer.roster.championship,
          is_official: true,
          is_reserve: validPlayer.roster.is_reserve,
          notes: validPlayer.roster.notes,
          player_id: validPlayer.player.id,
          position: validPlayer.roster.position,
          position_group: validPlayer.roster.position_group,
          roster_order: validPlayer.roster.roster_order,
          shirt_number: validPlayer.roster.shirt_number,
          source: validPlayer.roster.source,
          team_code: validPlayer.roster.team_code,
          team_name: validPlayer.roster.team_name,
          updated_at: now,
        }];
      });

      if (rows.length > 0) {
        const { error: upsertError } = await supabase
          .from("competition_rosters")
          .upsert(rows, { onConflict: "championship,player_id" });
        if (upsertError) throw upsertError;
      }
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
