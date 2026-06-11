import type { SupabaseClient } from "@supabase/supabase-js";
import type { Match, MatchStatus } from "@gol-de-ouro/shared";
import { calculateMatchStatus, predictionWindowPayload } from "@gol-de-ouro/shared";

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
  now = new Date(),
): Promise<MatchStatusUpdateSummary> => {
  const { data, error } = await supabase
    .from("matches")
    .select("id,home_team,away_team,start_time,prediction_open_at,prediction_close_at,status,deleted_at")
    .is("deleted_at", null)
    .neq("status", "encerrado");

  if (error) throw error;

  const matches = (data ?? []) as MatchRow[];
  const updated: MatchStatusUpdate[] = [];

  for (const match of matches) {
    const windowPayload = predictionWindowPayload(match.start_time);
    const nextStatus = calculateMatchStatus(
      {
        ...match,
        prediction_close_at: windowPayload.prediction_close_at,
        prediction_open_at: windowPayload.prediction_open_at
      },
      now,
    );

    const needsWindowUpdate =
      match.prediction_open_at !== windowPayload.prediction_open_at ||
      match.prediction_close_at !== windowPayload.prediction_close_at;
    const needsStatusUpdate = match.status !== nextStatus;

    if (!needsWindowUpdate && !needsStatusUpdate) continue;

    const updateResult = await supabase
      .from("matches")
      .update({
        ...windowPayload,
        status: nextStatus
      })
      .eq("id", match.id);

    if (updateResult.error) throw updateResult.error;

    updated.push({
      from: match.status,
      matchId: match.id,
      name: `${match.home_team} x ${match.away_team}`,
      to: nextStatus
    });
  }

  return {
    checkedCount: matches.length,
    updated
  };
};
