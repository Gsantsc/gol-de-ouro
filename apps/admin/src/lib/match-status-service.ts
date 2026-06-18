import type { SupabaseClient } from "@supabase/supabase-js";
import type { Match, MatchStatus } from "@gol-de-ouro/shared";

type MatchRow = Pick<
  Match,
  | "id"
  | "away_team"
  | "home_team"
  | "prediction_close_at"
  | "prediction_open_at"
  | "start_time"
  | "status"
> & {
  deleted_at?: string | null;
};

export type MatchStatusUpdate = {
  from: MatchStatus;
  matchId: string;
  name: string;
  to: MatchStatus;
};

export type MatchStatusUpdateSummary = {
  checkedCount: number;
  updated: MatchStatusUpdate[];
};

// AUTO STATUS UPDATE
export const updateMatchStatuses = async (
  supabase: SupabaseClient,
  _now = new Date(),
): Promise<MatchStatusUpdateSummary> => {
  const { data: beforeData, error: beforeError } = await supabase
    .from("matches")
    .select("id,home_team,away_team,start_time,prediction_open_at,prediction_close_at,status,deleted_at")
    .is("deleted_at", null)
    .neq("status", "encerrado");

  if (beforeError) throw beforeError;

  const beforeMatches = (beforeData ?? []) as MatchRow[];
  const { error: refreshError } = await supabase.rpc("refresh_match_statuses");
  if (refreshError) throw refreshError;

  const { data: afterData, error: afterError } = await supabase
    .from("matches")
    .select("id,home_team,away_team,start_time,prediction_open_at,prediction_close_at,status,deleted_at")
    .is("deleted_at", null)
    .neq("status", "encerrado");

  if (afterError) throw afterError;

  const beforeById = new Map(beforeMatches.map((match) => [match.id, match]));
  const updated = ((afterData ?? []) as MatchRow[]).flatMap((match) => {
    const previous = beforeById.get(match.id);
    if (!previous || previous.status === match.status) return [];
    return [{
      from: previous.status,
      matchId: match.id,
      name: `${match.home_team} x ${match.away_team}`,
      to: match.status
    }];
  });

  return {
    checkedCount: beforeMatches.length,
    updated
  };
};
