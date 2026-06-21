import type {
  Achievement,
  AppSettings,
  AppInvite,
  Group,
  GroupMember,
  Match,
  Notification,
  Player,
  Prediction,
  PredictionWinner,
  Profile,
  Ranking,
  Tournament
} from "@gol-de-ouro/shared";
import { sortRankings } from "@gol-de-ouro/shared";
import { withSupabaseTimeout } from "./async-control";
import { supabase } from "./supabase";

const debugLog = (...args: unknown[]) => {
  if (process.env.NODE_ENV !== "production") console.debug(...args);
};

const defaultAppSettings: AppSettings = { prediction_lock_minutes: 60 };

const logOptionalDataFailure = (label: string, error: unknown) => {
  if (process.env.NODE_ENV !== "production") {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[USER DATA] ${label} unavailable. Using fallback.`, message);
  }
};

const readOptionalResult = <T>(
  label: string,
  result: { data: T | null; error: unknown },
  fallback: T
) => {
  if (result.error) {
    logOptionalDataFailure(label, result.error);
    return fallback;
  }

  return result.data ?? fallback;
};

const readSupabaseErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message ?? "");
  }
  return "";
};

const shouldFallbackToPredictionUpsert = (error: unknown) => {
  const message = readSupabaseErrorMessage(error).toLowerCase();
  return message.includes("submit_prediction")
    && (
      message.includes("could not find")
      || message.includes("schema cache")
      || message.includes("function")
    );
};

const predictionSubmitMessage = (error: unknown) => {
  const message = readSupabaseErrorMessage(error);
  const normalized = message.toLowerCase();

  if (normalized.includes("sessao") || normalized.includes("session") || normalized.includes("jwt")) {
    return "Sessão expirada. Entre novamente.";
  }
  if (normalized.includes("aprovado") || normalized.includes("bloqueado")) {
    return "Seu cadastro ainda não está liberado para palpitar.";
  }
  if (normalized.includes("palpites encerr") || normalized.includes("janela") || normalized.includes("não aceita")) {
    return "Palpites encerrados para esta partida.";
  }
  if (normalized.includes("abrem 24h")) {
    return "Palpites abrem 24h antes do jogo.";
  }
  if (normalized.includes("placar")) {
    return "Placar inválido. Revise os gols informados.";
  }
  if (normalized.includes("vencedor")) {
    return "Selecione um vencedor válido.";
  }
  if (normalized.includes("partida")) {
    return "Partida não encontrada ou indisponível.";
  }

  return "Não foi possível enviar seu palpite agora. Tente novamente.";
};

const authDebugCounts = {
  fetchProfile: 0,
  getSession: 0,
  signIn: 0
};

const countAuthDebug = (key: keyof typeof authDebugCounts, ...args: unknown[]) => {
  authDebugCounts[key] += 1;
  debugLog(`[USER AUTH] ${key} #${authDebugCounts[key]}`, ...args);
};

export type UserDashboardData = {
  achievements: Achievement[];
  appInvites: AppInvite[];
  groups: Group[];
  groupMembers: GroupMember[];
  matches: Match[];
  notifications: Notification[];
  players: Player[];
  predictions: Prediction[];
  ranking: Ranking[];
  settings: AppSettings;
  tournaments: Tournament[];
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const getAppBaseUrl = () => {
  if (typeof window !== "undefined" && window.location.origin) return window.location.origin;
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://gol-de-ouro-app.vercel.app";
};

const normalizeProfile = (profile: Profile | null): Profile | null => {
  if (!profile) return null;
  return {
    ...profile,
    role: profile.role === "user" ? "player" : profile.role,
    status: profile.status ?? (profile.blocked ? "suspended" : profile.approval_status)
  };
};

export const signInUser = async (email: string, password: string) => {
  const normalizedEmail = normalizeEmail(email);
  countAuthDebug("signIn", normalizedEmail);
  debugLog("[USER AUTH] LOGIN_ATTEMPT", normalizedEmail);
  const { data, error } = await withSupabaseTimeout(
    supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password
    }),
    "Tempo esgotado ao autenticar."
  );

  if (error) {
    debugLog("[USER AUTH] LOGIN_FAILED", normalizedEmail, error.message);
    throw error;
  }
  if (!data.session) {
    debugLog("[USER AUTH] LOGIN_FAILED", normalizedEmail, "missing-session");
    throw new Error("Não foi possível autenticar.");
  }

  const profile = await ensureCurrentUserProfile();
  debugLog("[USER AUTH] PROFILE_LOADED", profile?.id, profile?.status ?? profile?.approval_status);
  await recordLogin();
  debugLog("[USER AUTH] LOGIN_SUCCESS", data.session.user.id);
  return data.session;
};

export const signUpUser = async ({
  email,
  name,
  password
}: {
  email: string;
  name: string;
  password: string;
}) => {
  const { data, error } = await withSupabaseTimeout(
    supabase.auth.signUp({
      email: normalizeEmail(email),
      options: { data: { name: name.trim() } },
      password
    }),
    "Tempo esgotado ao criar cadastro."
  );

  if (error) throw error;
  if (data.session) {
    await ensureCurrentUserProfile(name);
    await recordLogin();
  }

  return data;
};

export const signOutUser = () => supabase.auth.signOut({ scope: "global" });

export const ensureCurrentUserProfile = async (displayName?: string) => {
  const { data, error } = await withSupabaseTimeout(
    supabase.rpc("ensure_user_profile", {
      display_name: displayName?.trim() || null,
      signup_device_value: typeof navigator === "undefined" ? "web" : navigator.userAgent,
      signup_ip_value: null
    }),
    "Tempo esgotado ao carregar o perfil."
  );

  if (error) throw error;
  return normalizeProfile(data as Profile | null);
};

const recordLogin = async () => {
  const { error } = await withSupabaseTimeout(
    supabase.rpc("record_user_login"),
    "Tempo esgotado ao registrar login.",
  );
  if (error) debugLog("[USER AUTH] record login skipped", error.message);
};

export const getCurrentUserProfile = async () => {
  countAuthDebug("getSession", "current-profile");
  const { data: sessionData, error: sessionError } = await withSupabaseTimeout(
    supabase.auth.getSession(),
    "Tempo esgotado ao verificar a sessão."
  );
  if (sessionError) throw sessionError;

  const userId = sessionData.session?.user.id;
  if (!userId) return null;

  countAuthDebug("fetchProfile", userId);
  const { data, error } = await withSupabaseTimeout(
    supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .maybeSingle(),
    "Tempo esgotado ao carregar o usuario."
  );

  if (error) throw error;
  const profile = normalizeProfile((data as Profile | null) ?? (await ensureCurrentUserProfile()));
  debugLog("[USER AUTH] PROFILE_LOADED", profile?.id, profile?.status ?? profile?.approval_status);
  return profile;
};

export const loadUserDashboardData = async (userId: string): Promise<UserDashboardData> => {
  const [
    achievementsResult,
    tournamentsResult,
    matchesResult,
    predictionsResult,
    playersResult,
    rankingResult,
    publicProfilesResult,
    groupsResult,
    groupMembersResult,
    notificationsResult,
    appInvitesResult,
    settingsResult
  ] = await withSupabaseTimeout(Promise.all([
    supabase
      .from("achievements")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
    supabase.from("tournaments").select("*").order("name"),
    supabase.from("matches").select("*").order("start_time", { ascending: true }),
    supabase.from("predictions").select("*").eq("user_id", userId).order("submitted_at", { ascending: false }),
    supabase.from("players").select("*").eq("active", true).is("deleted_at", null).order("team_name").order("name"),
    supabase
      .from("rankings")
      .select("*")
      .order("total_points", { ascending: false })
      .order("exact_scores", { ascending: false }),
    supabase.rpc("list_public_user_profiles"),
    supabase
      .from("group_members")
      .select("*, group:groups(*, tournament:tournaments(name,type,slug))")
      .eq("user_id", userId)
      .is("deleted_at", null),
    supabase
      .from("group_members")
      .select("*")
      .is("deleted_at", null),
    supabase
      .from("notifications")
      .select("*")
      .or(`user_id.eq.${userId},user_id.is.null`)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("app_invites")
      .select("*")
      .eq("inviter_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase.rpc("get_app_settings")
  ]), "Tempo esgotado ao carregar o dashboard.");

  const requiredResults = [
    tournamentsResult,
    matchesResult,
    predictionsResult,
    playersResult,
    rankingResult,
    publicProfilesResult,
    groupsResult,
    groupMembersResult,
    notificationsResult
  ];
  const failed = requiredResults.find((result) => result.error);
  if (failed?.error) throw failed.error;

  const achievements = readOptionalResult("achievements", achievementsResult, []);
  const appInvites = readOptionalResult("app_invites", appInvitesResult, []);
  const settings = readOptionalResult("get_app_settings", settingsResult, [defaultAppSettings]);

  const publicProfiles = (publicProfilesResult.data ?? []) as Array<{ id: string; name: string }>;
  const profileById = new Map(publicProfiles.map((profile) => [profile.id, profile]));
  const withPublicUser = <T extends { user_id: string }>(item: T) => {
    const publicProfile = profileById.get(item.user_id);
    return {
      ...item,
      user: publicProfile ? { email: "", name: publicProfile.name } : undefined
    };
  };

  return {
    achievements: achievements as Achievement[],
    appInvites: appInvites as AppInvite[],
    groups: ((groupsResult.data ?? []) as Array<{ group?: Group | null }>)
      .map((membership) => membership.group)
      .filter(Boolean) as Group[],
    groupMembers: ((groupMembersResult.data ?? []) as GroupMember[]).map(withPublicUser),
    matches: (matchesResult.data ?? []) as Match[],
    notifications: (notificationsResult.data ?? []) as Notification[],
    players: (playersResult.data ?? []) as Player[],
    predictions: (predictionsResult.data ?? []) as Prediction[],
    ranking: sortRankings(((rankingResult.data ?? []) as Ranking[]).map(withPublicUser)),
    settings: ((settings[0] ?? defaultAppSettings) as AppSettings),
    tournaments: (tournamentsResult.data ?? []) as Tournament[]
  };
};

export const createUserGroup = async (name: string, championshipId: string) => {
  const { error } = await withSupabaseTimeout(
    supabase.rpc("create_group", {
      app_base_url: getAppBaseUrl(),
      group_name: name.trim(),
      target_championship_id: championshipId
    }),
    "Tempo esgotado ao criar liga."
  );
  if (error) throw error;
};

export const regenerateUserGroupInvite = async (groupId: string) => {
  const { error } = await withSupabaseTimeout(
    supabase.rpc("regenerate_group_invite", {
      app_base_url: getAppBaseUrl(),
      target_group_id: groupId
    }),
    "Tempo esgotado ao regenerar convite."
  );
  if (error) throw error;
};

export const deactivateUserGroupInvite = async (groupId: string) => {
  const { error } = await withSupabaseTimeout(
    supabase.rpc("deactivate_group_invite", { target_group_id: groupId }),
    "Tempo esgotado ao desativar convite."
  );
  if (error) throw error;
};

export const joinUserGroupByInvite = async (invite: string) => {
  const { error } = await withSupabaseTimeout(
    supabase.rpc("join_group_by_invite", { invite: invite.trim() }),
    "Tempo esgotado ao entrar na liga."
  );
  if (error) throw error;
};

export const createUserAppInvite = async () => {
  const { data, error } = await withSupabaseTimeout(
    supabase.rpc("create_app_invite", {
      app_base_url: getAppBaseUrl(),
      invited_email: null
    }),
    "Tempo esgotado ao criar convite do app."
  );
  if (error) throw error;
  return data as AppInvite;
};

export const revokeUserAppInvite = async (inviteId: string) => {
  const { error } = await withSupabaseTimeout(
    supabase.rpc("revoke_app_invite", { target_invite_id: inviteId }),
    "Tempo esgotado ao revogar convite."
  );
  if (error) throw error;
};

export const submitUserPrediction = async ({
  awayScore,
  bothTeamsScore,
  firstScorer: _firstScorer,
  firstScorerId,
  firstGoalNoGoals,
  homeScore,
  manOfMatch: _manOfMatch,
  manOfMatchId,
  matchId,
  redCard,
  winner,
  userId
}: {
  awayScore: number;
  bothTeamsScore: boolean;
  firstScorer: string | null;
  firstScorerId: string | null;
  firstGoalNoGoals: boolean;
  homeScore: number;
  manOfMatch: string | null;
  manOfMatchId: string | null;
  matchId: string;
  redCard: boolean;
  winner: PredictionWinner;
  userId: string;
}) => {
  const rpcPayload = {
    away_score_value: awayScore,
    both_teams_score_value: bothTeamsScore,
    first_goal_no_goals_value: firstGoalNoGoals,
    first_scorer_id_value: firstGoalNoGoals ? null : firstScorerId,
    home_score_value: homeScore,
    man_of_match_id_value: manOfMatchId,
    predicted_winner_value: winner,
    red_card_value: redCard,
    target_match_id: matchId
  };
  const directPayload = {
    match_id: matchId,
    predicted_away_score: awayScore,
    predicted_both_teams_score: bothTeamsScore,
    predicted_first_goal_no_goals: firstGoalNoGoals,
    predicted_first_scorer: null,
    predicted_first_scorer_id: firstGoalNoGoals ? null : firstScorerId,
    predicted_home_score: homeScore,
    predicted_man_of_match: null,
    predicted_man_of_match_id: manOfMatchId,
    predicted_red_card: redCard,
    predicted_winner: winner,
    user_id: userId
  };

  const { error } = await withSupabaseTimeout(
    supabase.rpc("submit_prediction", rpcPayload),
    "Tempo esgotado ao salvar o palpite."
  );
  if (!error) return;

  if (shouldFallbackToPredictionUpsert(error)) {
    debugLog("[USER PREDICTION] submit_prediction RPC unavailable. Trying direct upsert fallback.");
    const { error: upsertError } = await withSupabaseTimeout(
      supabase.from("predictions").upsert(directPayload, { onConflict: "user_id,match_id" }),
      "Tempo esgotado ao salvar o palpite."
    );

    if (!upsertError) return;
    debugLog("[USER PREDICTION] direct upsert failed", readSupabaseErrorMessage(upsertError));
    throw new Error(predictionSubmitMessage(upsertError));
  }

  debugLog("[USER PREDICTION] submit failed", readSupabaseErrorMessage(error));
  throw new Error(predictionSubmitMessage(error));
};
