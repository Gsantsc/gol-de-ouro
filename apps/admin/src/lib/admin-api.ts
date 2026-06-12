// LEAGUE AUDIT
// SUPPORTED CHAMPIONSHIPS
import type {
  AdminLog,
  AdminMetrics,
  AdminUserOverview,
  BetaFeedback,
  Competition,
  CompetitionGroup,
  Group,
  GroupMember,
  Match,
  Player,
  Profile,
  Ranking,
  Tournament,
  TournamentType
} from "@gol-de-ouro/shared";
import { withSupabaseTimeout } from "./async-control";
import { supabase } from "./supabase";

const debugLog = (...args: unknown[]) => {
  if (process.env.NODE_ENV !== "production") console.debug(...args);
};

const getAppBaseUrl = () => {
  if (typeof window !== "undefined" && window.location.origin) return window.location.origin;
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://goldeouro.app";
};

export const signInAdmin = async (email: string, password: string) => {
  const normalizedEmail = email.trim().toLowerCase();
  debugLog("[ADMIN AUTH] LOGIN START", normalizedEmail);

  const { data, error } = await withSupabaseTimeout(
    supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password
    }),
    "Tempo esgotado ao autenticar administrador."
  );

  if (error) {
    debugLog("[ADMIN AUTH] LOGIN ERROR", error.message);
    throw error;
  }

  if (!data.session) {
    debugLog("[ADMIN AUTH] LOGIN NO SESSION", data);
    throw new Error("Não foi possível autenticar.");
  }

  debugLog("[ADMIN AUTH] LOGIN SUCCESS", data.session.user.id);
  debugLog("[ADMIN AUTH] SESSION FOUND", data.session.user.email);
  await ensureCurrentProfile();
  await recordLogin();
  return data.session;
};

const normalizeProfile = (profile: Profile | null): Profile | null => {
  if (!profile) return null;
  return {
    ...profile,
    role: profile.role === "user" ? "player" : profile.role,
    status: profile.status ?? (profile.blocked ? "suspended" : profile.approval_status)
  };
};

export const ensureCurrentProfile = async () => {
  const { data, error } = await withSupabaseTimeout(
    supabase.rpc("ensure_user_profile", {
      display_name: null,
      signup_device_value: typeof navigator === "undefined" ? "web" : navigator.userAgent,
      signup_ip_value: null
    }),
    "Tempo esgotado ao carregar perfil administrativo."
  );

  if (error) throw error;
  return normalizeProfile(data as Profile | null);
};

const recordLogin = async () => {
  const { error } = await withSupabaseTimeout(
    supabase.rpc("record_user_login"),
    "Tempo esgotado ao registrar login.",
  );
  if (error) debugLog("[ADMIN AUTH] record login skipped", error.message);
};

export const getCurrentProfile = async () => {
  const { data: sessionData, error: sessionError } = await withSupabaseTimeout(
    supabase.auth.getSession(),
    "Tempo esgotado ao verificar a sessão administrativa."
  );
  debugLog(
    "[ADMIN AUTH] getCurrentProfile session",
    sessionData.session?.user.id,
    sessionData.session?.user.email
  );
  if (sessionError) throw sessionError;
  const userId = sessionData.session?.user.id;
  if (!userId) return null;
  debugLog("[ADMIN AUTH] SESSION FOUND", sessionData.session?.user.email);

  const { data, error } = await withSupabaseTimeout(
    supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .maybeSingle(),
    "Tempo esgotado ao carregar usuario administrativo."
  );

  if (error) throw error;
  if (data) {
    const profile = normalizeProfile(data as Profile | null);
    debugLog("[ADMIN AUTH] ROLE FOUND", profile?.role, profile?.status);
    return profile;
  }

  const profile = await ensureCurrentProfile();
  debugLog("[ADMIN AUTH] ROLE FOUND", profile?.role, profile?.status);
  return profile;
};

export const loadAdminData = async () => {
  const [
    metricsResult,
    usersResult,
    tournamentsResult,
    matchesResult,
    rankingsResult,
    logsResult,
    groupsResult,
    groupMembersResult,
    competitionsResult,
    competitionGroupsResult,
    usersOverviewResult,
    playersResult,
    feedbackResult
  ] = await withSupabaseTimeout(
    Promise.all([
      supabase.rpc("admin_dashboard_metrics"),
      supabase.from("users").select("*").order("created_at", { ascending: false }),
      supabase.from("tournaments").select("*").order("name"),
      supabase.from("matches").select("*").order("start_time", { ascending: false }),
      supabase
        .from("rankings")
        .select("*, user:users(name,email)")
        .order("total_points", { ascending: false }),
      supabase.from("admin_logs").select("*").order("created_at", { ascending: false }).limit(30),
      supabase.from("groups").select("*, tournament:tournaments(name,type,slug)").order("created_at", { ascending: false }),
      supabase.from("group_members").select("*, user:users(name,email)").is("deleted_at", null),
      supabase.from("competitions").select("*").order("created_at", { ascending: false }),
      supabase.from("competition_groups").select("*, group:groups(*)"),
      supabase.rpc("admin_user_overview"),
      supabase.from("players").select("*").eq("active", true).is("deleted_at", null).order("team_name").order("name"),
      supabase
        .from("app_feedback")
        .select("*, user:users(name,email)")
        .order("created_at", { ascending: false })
        .limit(20)
    ]),
    "Tempo esgotado ao carregar dados administrativos."
  );

  const results = [
    metricsResult,
    usersResult,
    tournamentsResult,
    matchesResult,
    rankingsResult,
    logsResult,
    groupsResult,
    groupMembersResult,
    competitionsResult,
    competitionGroupsResult,
    usersOverviewResult,
    playersResult,
    feedbackResult
  ];
  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;

  return {
    logs: (logsResult.data ?? []) as AdminLog[],
    matches: (matchesResult.data ?? []) as Match[],
    metrics: ((metricsResult.data?.[0] ?? {
      approved_users: 0,
      finished_matches: 0,
      live_matches: 0,
      open_matches: 0,
      pending_users: 0,
      total_predictions: 0,
      total_users: 0
    }) as AdminMetrics),
    rankings: (rankingsResult.data ?? []) as Ranking[],
    players: (playersResult.data ?? []) as Player[],
    tournaments: (tournamentsResult.data ?? []) as Tournament[],
    users: (usersResult.data ?? []) as Profile[],
    userOverview: (usersOverviewResult.data ?? []) as AdminUserOverview[],
    groups: (groupsResult.data ?? []) as Group[],
    groupMembers: (groupMembersResult.data ?? []) as GroupMember[],
    competitions: (competitionsResult.data ?? []) as Competition[],
    competitionGroups: (competitionGroupsResult.data ?? []) as CompetitionGroup[],
    feedback: (feedbackResult.data ?? []) as BetaFeedback[]
  };
};

export const loadPendingApprovals = async () => {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("status", "pending")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((item) => normalizeProfile(item as Profile) as Profile);
};

export const approveUser = async (userId: string) => {
  const { error } = await supabase.rpc("approve_user", { target_user_id: userId });
  if (error) throw error;
};

export const rejectUser = async (userId: string) => {
  const { error } = await supabase.rpc("reject_user", { reason: null, target_user_id: userId });
  if (error) throw error;
};

export const rejectUserWithReason = async (userId: string, reason: string | null) => {
  const { error } = await supabase.rpc("reject_user", { reason, target_user_id: userId });
  if (error) throw error;
};

export const blockUser = async (userId: string) => {
  const { error } = await supabase.rpc("block_user", { target_user_id: userId });
  if (error) throw error;
};

export const unblockUser = async (userId: string) => {
  const { error } = await supabase.rpc("unblock_user", { target_user_id: userId });
  if (error) throw error;
};

export const suspendUser = async (userId: string) => {
  const { error } = await supabase.rpc("suspend_user", { target_user_id: userId });
  if (error) throw error;
};

export const reactivateUser = async (userId: string) => {
  const { error } = await supabase.rpc("reactivate_user", { target_user_id: userId });
  if (error) throw error;
};

export const softRemoveUser = async (userId: string) => {
  const { error } = await supabase.rpc("soft_remove_user", { target_user_id: userId });
  if (error) throw error;
};

export const forceRefreshRanking = async () => {
  const { error } = await supabase.rpc("force_refresh_rankings");
  if (error) throw error;
};

export const finishMatchAndScore = async (matchId: string) => {
  const { error } = await supabase.rpc("finish_match_and_score", { target_match_id: matchId });
  if (error) throw error;
};

export const createTournament = async (payload: {
  name: string;
  type: TournamentType;
  slug?: string | null;
  active: boolean;
}) => {
  const { error } = await supabase.from("tournaments").insert(payload);
  if (error) throw error;
};

export const toggleTournament = async (tournament: Tournament) => {
  const { error } = await supabase
    .from("tournaments")
    .update({ active: !tournament.active })
    .eq("id", tournament.id);
  if (error) throw error;
};

export const createMatch = async (payload: {
  tournament_id: string;
  home_team: string;
  away_team: string;
  home_team_logo_url?: string | null;
  away_team_logo_url?: string | null;
  start_time: string;
  status: "aberto" | "fechado" | "ao_vivo" | "encerrado";
  championship?: string | null;
  stadium?: string | null;
  round?: string | null;
}) => {
  const { error } = await supabase.from("matches").insert(payload);
  if (error) throw error;
};

export const updateMatch = async (
  matchId: string,
  payload: Partial<Pick<
    Match,
    | "away_score"
    | "first_goal_scorer"
    | "first_goal_scorer_id"
    | "first_goal_no_goals"
    | "home_score"
    | "man_of_match"
    | "man_of_match_id"
    | "red_card_happened"
    | "start_time"
    | "status"
  >>,
) => {
  const { error } = await supabase.from("matches").update(payload).eq("id", matchId);
  if (error) throw error;
};

export const createGroup = async (name: string, championshipId: string) => {
  const { error } = await supabase.rpc("create_group", {
    app_base_url: getAppBaseUrl(),
    group_name: name,
    target_championship_id: championshipId
  });
  if (error) throw error;
};

export const closeGroup = async (groupId: string) => {
  const { error } = await supabase.rpc("close_group", { target_group_id: groupId });
  if (error) throw error;
};

export const removeGroupMember = async (groupId: string, userId: string) => {
  const { error } = await supabase.rpc("remove_group_member", {
    target_group_id: groupId,
    target_user_id: userId
  });
  if (error) throw error;
};

export const createCompetition = async (name: string, groupIds: string[]) => {
  const { error } = await supabase.rpc("create_competition", {
    competition_name: name,
    target_group_ids: groupIds
  });
  if (error) throw error;
};

export const syncAutomaticMatches = async (_tournaments: Tournament[]) => {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("Sessão administrativa expirada.");

  const response = await fetch("/api/admin/sync-matches", {
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    method: "POST"
  });

  const payload = (await response.json()) as { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "Não foi possível sincronizar partidas.");
};

export const updateAutomaticMatchStatuses = async () => {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("Sessão administrativa expirada.");

  const response = await fetch("/api/admin/update-match-statuses", {
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    method: "POST"
  });

  const payload = (await response.json()) as { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "Não foi possível atualizar status das partidas.");
};

export const syncEspnResults = async () => {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("Sessão administrativa expirada.");

  const response = await fetch("/api/admin/sync-espn", {
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    method: "POST"
  });

  const payload = (await response.json()) as { error?: string; updatedCount?: number; finished?: number; live?: number };
  if (!response.ok) throw new Error(payload.error ?? "Não foi possível atualizar resultados pela ESPN.");
  return payload;
};
