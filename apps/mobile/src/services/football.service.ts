import type {
  Match,
  MatchEvent,
  MatchStatistics,
  AppInvite,
  BetaFeedbackType,
  Prediction,
  PredictionWinner,
  Ranking,
  Tournament,
  Group,
  GroupMember,
  Achievement,
  AppSettings,
  Competition,
  CompetitionGroup,
  Notification,
  Player
} from "../shared";
import Constants from "expo-constants";
import { sortRankings } from "../shared";
import { supabase } from "./supabase";

type PublicUserProfile = {
  id: string;
  name: string;
};

let publicProfilesRequest: Promise<Map<string, PublicUserProfile>> | null = null;

const getAppBaseUrl = () => {
  const origin = typeof globalThis.location !== "undefined" ? globalThis.location.origin : "";
  return origin || "https://goldeouro.app";
};

const loadPublicProfiles = () => {
  if (!publicProfilesRequest) {
    publicProfilesRequest = (async () => {
      const { data, error } = await supabase.rpc("list_public_user_profiles");
      if (error) throw error;
      const profiles = (data ?? []) as PublicUserProfile[];
      return new Map(profiles.map((profile) => [profile.id, profile]));
    })().finally(() => {
      publicProfilesRequest = null;
    });
  }

  return publicProfilesRequest;
};

export const listTournaments = async () => {
  const { data, error } = await supabase
    .from("tournaments")
    .select("*")
    .order("type", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Tournament[];
};

export const listMatches = async (tournamentId?: string) => {
  let query = supabase.from("matches").select("*").order("start_time", { ascending: true });

  if (tournamentId) {
    query = query.eq("tournament_id", tournamentId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Match[];
};

export const getAppSettings = async () => {
  const { data, error } = await supabase.rpc("get_app_settings");
  if (error) throw error;
  return ((data?.[0] ?? { prediction_lock_minutes: 60 }) as AppSettings);
};

export const listMyPredictions = async (userId: string) => {
  const { data, error } = await supabase
    .from("predictions")
    .select("*")
    .eq("user_id", userId);

  if (error) throw error;
  return (data ?? []) as Prediction[];
};

export const listPlayers = async () => {
  const { data, error } = await supabase
    .from("players")
    .select("*")
    .eq("active", true)
    .is("deleted_at", null)
    .order("team_name")
    .order("name");

  if (error) throw error;
  return (data ?? []) as Player[];
};

export const listNotifications = async (userId: string) => {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .or(`user_id.eq.${userId},user_id.is.null`)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) throw error;
  return (data ?? []) as Notification[];
};

export const listAppInvites = async (userId: string) => {
  const { data, error } = await supabase
    .from("app_invites")
    .select("*")
    .eq("inviter_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) throw error;
  return (data ?? []) as AppInvite[];
};

export const submitPrediction = async ({
  userId,
  matchId,
  homeScore,
  awayScore,
  winner,
  firstScorer: _firstScorer,
  firstScorerId,
  firstGoalNoGoals,
  bothTeamsScore,
  manOfMatch: _manOfMatch,
  manOfMatchId,
  redCard
}: {
  userId: string;
  matchId: string;
  homeScore: number;
  awayScore: number;
  winner: PredictionWinner;
  firstScorer: string | null;
  firstScorerId: string | null;
  firstGoalNoGoals: boolean;
  bothTeamsScore: boolean;
  manOfMatch: string | null;
  manOfMatchId: string | null;
  redCard: boolean;
}) => {
  const { error } = await supabase.rpc("submit_prediction", {
    away_score_value: awayScore,
    both_teams_score_value: bothTeamsScore,
    first_goal_no_goals_value: firstGoalNoGoals,
    first_scorer_id_value: firstScorerId,
    home_score_value: homeScore,
    man_of_match_id_value: manOfMatchId,
    predicted_winner_value: winner,
    red_card_value: redCard,
    target_match_id: matchId
  });

  if (error) throw error;
};

export const listRanking = async () => {
  const [{ data, error }, profiles] = await Promise.all([
    supabase
      .from("rankings")
      .select("*")
      .order("total_points", { ascending: false })
      .order("exact_scores", { ascending: false }),
    loadPublicProfiles(),
  ]);

  if (error) throw error;
  return sortRankings(((data ?? []) as Ranking[]).map((ranking) => {
    const profile = profiles.get(ranking.user_id);
    return {
      ...ranking,
      user: profile ? { email: "", name: profile.name } : undefined
    };
  }));
};

export const getMatchStatistics = async (matchId: string) => {
  const { data, error } = await supabase
    .from("match_statistics")
    .select("*")
    .eq("match_id", matchId)
    .maybeSingle();

  if (error) throw error;
  return data as MatchStatistics | null;
};

export const listMatchEvents = async (matchId: string) => {
  const { data, error } = await supabase
    .from("match_events")
    .select("*")
    .eq("match_id", matchId)
    .order("minute", { ascending: true });

  if (error) throw error;
  return (data ?? []) as MatchEvent[];
};

export const listMatchPredictions = async (matchId: string) => {
  const { data, error } = await supabase
    .from("predictions")
    .select("*, user:users(name,email)")
    .eq("match_id", matchId)
    .order("submitted_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Array<Prediction & { user?: { name: string; email: string } }>;
};

export const listMyGroups = async (userId: string) => {
  const { data: memberships, error: membershipsError } = await supabase
    .from("group_members")
    .select("*, group:groups(*, tournament:tournaments(name,type,slug))")
    .eq("user_id", userId)
    .is("deleted_at", null);

  if (membershipsError) throw membershipsError;

  return (memberships ?? []).map((membership) => membership.group) as Group[];
};

export const listGroupMembers = async () => {
  const [{ data, error }, profiles] = await Promise.all([
    supabase
      .from("group_members")
      .select("*")
      .is("deleted_at", null),
    loadPublicProfiles(),
  ]);

  if (error) throw error;
  return ((data ?? []) as GroupMember[]).map((member) => {
    const profile = profiles.get(member.user_id);
    return {
      ...member,
      user: profile ? { email: "", name: profile.name } : undefined
    };
  });
};

export const createGroup = async (name: string, championshipId: string) => {
  const { error } = await supabase.rpc("create_group", {
    app_base_url: getAppBaseUrl(),
    group_name: name,
    target_championship_id: championshipId
  });
  if (error) throw error;
};

export const joinGroupByInvite = async (invite: string) => {
  const { error } = await supabase.rpc("join_group_by_invite", { invite });
  if (error) throw error;
};

export const leaveGroup = async (groupId: string) => {
  const { error } = await supabase.rpc("leave_group", { target_group_id: groupId });
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

export const createGroupInvite = async (groupId: string) => {
  const { data, error } = await supabase.rpc("create_group_invite", {
    app_base_url: getAppBaseUrl(),
    target_group_id: groupId
  });
  if (error) throw error;
  return data as string;
};

export const regenerateGroupInvite = async (groupId: string) => {
  const { error } = await supabase.rpc("regenerate_group_invite", {
    app_base_url: getAppBaseUrl(),
    target_group_id: groupId
  });
  if (error) throw error;
};

export const deactivateGroupInvite = async (groupId: string) => {
  const { error } = await supabase.rpc("deactivate_group_invite", { target_group_id: groupId });
  if (error) throw error;
};

export const createAppInvite = async () => {
  const { data, error } = await supabase.rpc("create_app_invite", {
    app_base_url: getAppBaseUrl(),
    invited_email: null
  });
  if (error) throw error;
  return data as AppInvite;
};

export const revokeAppInvite = async (inviteId: string) => {
  const { error } = await supabase.rpc("revoke_app_invite", { target_invite_id: inviteId });
  if (error) throw error;
};

export const acceptAppInvite = async (invite: string) => {
  const { error } = await supabase.rpc("accept_app_invite", { invite });
  if (error) throw error;
};

export const submitBetaFeedback = async ({
  description,
  type,
  userId
}: {
  description: string;
  type: BetaFeedbackType;
  userId: string;
}) => {
  const trimmedDescription = description.trim();
  if (trimmedDescription.length < 8) {
    throw new Error("Descreva um pouco melhor antes de enviar.");
  }

  const extra = Constants.expoConfig?.extra ?? {};
  const appEnv = String(extra.appEnv ?? process.env.EXPO_PUBLIC_APP_ENV ?? "development");
  const appVersion = Constants.expoConfig?.version ?? null;

  const { error } = await supabase.from("app_feedback").insert({
    app_env: appEnv,
    app_version: appVersion,
    description: trimmedDescription,
    metadata: {
      source: "mobile_profile"
    },
    type,
    user_id: userId
  });

  if (error) throw error;
};

export const listAchievements = async (userId: string) => {
  const { data, error } = await supabase
    .from("achievements")
    .select("*")
    .eq("user_id", userId)
    .order("unlocked_at", { ascending: false, nullsFirst: false });

  if (error) throw error;
  return (data ?? []) as Achievement[];
};

export const listCompetitions = async () => {
  const [competitionsResult, competitionGroupsResult] = await Promise.all([
    supabase.from("competitions").select("*").order("created_at", { ascending: false }),
    supabase.from("competition_groups").select("*, group:groups(*)")
  ]);

  if (competitionsResult.error) throw competitionsResult.error;
  if (competitionGroupsResult.error) throw competitionGroupsResult.error;

  return {
    competitionGroups: (competitionGroupsResult.data ?? []) as CompetitionGroup[],
    competitions: (competitionsResult.data ?? []) as Competition[]
  };
};

export const createCompetition = async (name: string, groupIds: string[]) => {
  const { error } = await supabase.rpc("create_competition", {
    competition_name: name,
    target_group_ids: groupIds
  });
  if (error) throw error;
};
