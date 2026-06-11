import type {
  Achievement,
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
  tournaments: Tournament[];
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const getAppBaseUrl = () => {
  if (typeof window !== "undefined" && window.location.origin) return window.location.origin;
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://goldeouro.app";
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
  const { data, error } = await withSupabaseTimeout(
    supabase.auth.signInWithPassword({
      email: normalizeEmail(email),
      password
    }),
    "Tempo esgotado ao autenticar."
  );

  if (error) throw error;
  if (!data.session) throw new Error("Não foi possível autenticar.");

  await ensureCurrentUserProfile();
  await recordLogin();
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
  const { data: sessionData, error: sessionError } = await withSupabaseTimeout(
    supabase.auth.getSession(),
    "Tempo esgotado ao verificar a sessão."
  );
  if (sessionError) throw sessionError;

  const userId = sessionData.session?.user.id;
  if (!userId) return null;

  const { data, error } = await withSupabaseTimeout(
    supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .maybeSingle(),
    "Tempo esgotado ao carregar o usuario."
  );

  if (error) throw error;
  return normalizeProfile((data as Profile | null) ?? (await ensureCurrentUserProfile()));
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
    appInvitesResult
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
      .limit(10)
  ]), "Tempo esgotado ao carregar o dashboard.");

  const results = [
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
    appInvitesResult
  ];
  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;
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
    achievements: (achievementsResult.data ?? []) as Achievement[],
    appInvites: (appInvitesResult.data ?? []) as AppInvite[],
    groups: ((groupsResult.data ?? []) as Array<{ group?: Group | null }>)
      .map((membership) => membership.group)
      .filter(Boolean) as Group[],
    groupMembers: ((groupMembersResult.data ?? []) as GroupMember[]).map(withPublicUser),
    matches: (matchesResult.data ?? []) as Match[],
    notifications: (notificationsResult.data ?? []) as Notification[],
    players: (playersResult.data ?? []) as Player[],
    predictions: (predictionsResult.data ?? []) as Prediction[],
    ranking: sortRankings(((rankingResult.data ?? []) as Ranking[]).map(withPublicUser)),
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
  const { error } = await withSupabaseTimeout(
    supabase
      .from("predictions")
      .upsert({
        match_id: matchId,
        predicted_away_score: awayScore,
        predicted_both_teams_score: bothTeamsScore,
        predicted_first_scorer: null,
        predicted_first_scorer_id: firstScorerId,
        predicted_first_goal_no_goals: firstGoalNoGoals,
        predicted_home_score: homeScore,
        predicted_man_of_match: null,
        predicted_man_of_match_id: manOfMatchId,
        predicted_red_card: redCard,
        predicted_winner: winner,
        user_id: userId
      }, {
        onConflict: "user_id,match_id"
      }),
    "Tempo esgotado ao salvar o palpite."
  );

  if (error) throw error;
};
