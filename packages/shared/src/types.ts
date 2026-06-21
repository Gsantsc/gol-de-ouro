// LEAGUE AUDIT
// SUPPORTED CHAMPIONSHIPS
export type Role = "admin" | "player" | "user";

export type ApprovalStatus = "pending" | "approved" | "rejected" | "suspended";

export type MatchStatus = "aberto" | "fechado" | "ao_vivo" | "encerrado";

export type PredictionWinner = "home" | "away" | "draw";

export type TournamentType =
  | "world_cup"
  | "champions_league"
  | "libertadores"
  | "brasileirao";

export type ChampionshipKey =
  | "world_cup_2026"
  | "libertadores"
  | "sul_americana"
  | "brasileirao_a"
  | "copa_do_brasil"
  | "champions_league";

export type EventType = "goal" | "yellow_card" | "red_card" | "substitution";

export type Player = {
  id: string;
  name: string;
  team_id?: string | null;
  team_code: string;
  team_name: string;
  position?: string | null;
  shirt_number?: number | null;
  active: boolean;
  source?: string | null;
  source_updated_at?: string | null;
  external_id?: string | null;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
};

export type Profile = {
  id: string;
  name: string;
  email: string;
  role: Role;
  approval_status: ApprovalStatus;
  status?: ApprovalStatus;
  blocked: boolean;
  created_at: string;
  updated_at?: string;
  approved_at?: string | null;
  approved_by?: string | null;
  rejection_reason?: string | null;
  last_login_at?: string | null;
  last_activity_at?: string | null;
  signup_ip?: string | null;
  signup_device?: string | null;
  deleted_at: string | null;
};

export type Tournament = {
  id: string;
  name: string;
  type: TournamentType;
  slug?: ChampionshipKey | string | null;
  active: boolean;
  deleted_at: string | null;
};

export type Match = {
  id: string;
  tournament_id: string;
  home_team: string;
  away_team: string;
  home_team_logo_url: string | null;
  away_team_logo_url: string | null;
  home_score: number;
  away_score: number;
  first_goal_scorer?: string | null;
  first_goal_scorer_id?: string | null;
  first_goal_no_goals?: boolean;
  man_of_match?: string | null;
  man_of_match_id?: string | null;
  red_card_happened?: boolean | null;
  red_cards_home?: number;
  red_cards_away?: number;
  start_time: string;
  start_time_utc?: string | null;
  prediction_open_at: string;
  prediction_close_at: string;
  status: MatchStatus;
  championship?: string | null;
  stadium?: string | null;
  venue_timezone?: string | null;
  source_timezone?: string | null;
  kickoff_source?: string | null;
  kickoff_verified_at?: string | null;
  display_time_br?: string | null;
  round?: string | null;
  provider_name?: string | null;
  provider_external_id?: string | null;
  is_golden_match?: boolean;
  is_upset?: boolean;
  live_score?: { home: number; away: number } | null;
  stats?: Record<string, unknown> | null;
  updated_at?: string;
  last_synced_at?: string | null;
  deleted_at: string | null;
};

export type Prediction = {
  id: string;
  user_id: string;
  match_id: string;
  predicted_home_score: number;
  predicted_away_score: number;
  predicted_winner?: PredictionWinner | null;
  predicted_first_scorer?: string | null;
  predicted_first_scorer_id?: string | null;
  predicted_first_goal_no_goals?: boolean;
  predicted_both_teams_score?: boolean | null;
  predicted_man_of_match?: string | null;
  predicted_man_of_match_id?: string | null;
  predicted_red_card?: boolean | null;
  locked: boolean;
  submitted_at: string;
  points: number;
};

export type Ranking = {
  id: string;
  user_id: string;
  total_points: number;
  correct_results: number;
  exact_scores: number;
  updated_at: string;
  user?: Pick<Profile, "name" | "email">;
};

export type MatchStatistics = {
  id: string;
  match_id: string;
  possession_home: number;
  possession_away: number;
  shots_home: number;
  shots_away: number;
  shots_on_goal_home: number;
  shots_on_goal_away: number;
  corners_home: number;
  corners_away: number;
  fouls_home: number;
  fouls_away: number;
  yellow_cards_home: number;
  yellow_cards_away: number;
  red_cards_home: number;
  red_cards_away: number;
  xg_home: number;
  xg_away: number;
  updated_at: string;
};

export type MatchEvent = {
  id: string;
  match_id: string;
  minute: number;
  type: EventType;
  description: string;
  created_at: string;
};

export type AdminLog = {
  id: string;
  admin_id: string;
  action: string;
  entity: string;
  entity_id: string | null;
  created_at: string;
};

export type MatchProviderRun = {
  id: string;
  provider_name: string;
  status: "success" | "failed";
  message: string | null;
  inserted_count: number;
  updated_count: number;
  created_at: string;
  triggered_by?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  checked_matches?: number | null;
  updated_matches?: number | null;
  live_matches?: number | null;
  finished_matches?: number | null;
  scored_predictions?: number | null;
  ranking_updated?: number | null;
  standings_updated?: number | null;
  knockout_updated?: number | null;
  error_message?: string | null;
};

export type AdminMetrics = {
  total_users: number;
  pending_users: number;
  approved_users: number;
  open_matches: number;
  live_matches: number;
  finished_matches: number;
  total_predictions: number;
};

export type AppSettings = {
  prediction_lock_minutes: 60 | 90 | 120 | 180;
};

export type Group = {
  id: string;
  name: string;
  championship_id: string;
  owner_id: string;
  invite_code: string;
  invite_token: string;
  invite_url: string;
  invite_created_at: string;
  invite_expires_at: string | null;
  invite_active: boolean;
  created_at: string;
  closed_at: string | null;
  deleted_at: string | null;
  tournament?: Pick<Tournament, "name" | "type" | "slug">;
};

export type GroupMember = {
  id: string;
  group_id: string;
  user_id: string;
  role: "owner" | "member";
  joined_at: string;
  deleted_at: string | null;
  user?: Pick<Profile, "name" | "email">;
};

export type GroupInvite = {
  id: string;
  group_id: string;
  code: string;
  invite_token?: string | null;
  invite_url?: string | null;
  invite_active?: boolean;
  max_uses?: number | null;
  used_count?: number;
  created_by: string;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
};

export type GroupInvitePreview = {
  group_id: string;
  group_name: string;
  championship_id: string;
  championship_name: string;
  participant_count: number;
  invite_token: string;
  invite_url: string;
  invite_active: boolean;
};

export type GroupInviteAcceptResult = {
  status: "joined" | "already_member" | "pending_approval";
  group_id: string;
  group_name: string;
  membership_created: boolean;
};

export type AppInvite = {
  id: string;
  inviter_user_id: string;
  invited_email: string | null;
  invite_token: string;
  invite_url: string;
  status: "pending" | "accepted" | "expired" | "revoked";
  created_at: string;
  accepted_at: string | null;
  accepted_user_id: string | null;
  expires_at: string | null;
  revoked_at: string | null;
};

export type BetaFeedbackType = "problem" | "suggestion";

export type BetaFeedbackStatus = "open" | "reviewing" | "resolved" | "dismissed";

export type BetaFeedback = {
  id: string;
  user_id: string;
  type: BetaFeedbackType;
  description: string;
  app_version: string | null;
  app_env: string;
  status: BetaFeedbackStatus;
  admin_comment: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  user?: Pick<Profile, "name" | "email">;
};

export type Achievement = {
  id: string;
  user_id: string;
  badge: string;
  icon: string;
  description: string;
  progress: number;
  goal: number;
  unlocked_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Competition = {
  id: string;
  name: string;
  owner_id: string;
  status: "active" | "closed";
  created_at: string;
  closed_at: string | null;
  deleted_at: string | null;
};

export type CompetitionGroup = {
  id: string;
  competition_id: string;
  group_id: string;
  created_at: string;
  group?: Group;
};

export type Notification = {
  id: string;
  user_id: string | null;
  title: string;
  body: string;
  read_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type AdminUserOverview = Profile & {
  groups_count: number;
  predictions_count: number;
  last_activity_at: string | null;
};
