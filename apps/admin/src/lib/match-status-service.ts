import type { SupabaseClient } from "@supabase/supabase-js";
import type { Match, MatchStatus } from "@gol-de-ouro/shared";
import { calculateMatchStatus } from "@gol-de-ouro/shared";

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
  byStatus: Record<MatchStatus, number>;
  checkedCount: number;
  updated: MatchStatusUpdate[];
};

// AUTO STATUS UPDATE
export const updateMatchStatuses = async (
  supabase: SupabaseClient,
  now = new Date(),
): Promise<MatchStatusUpdateSummary> => {
  const { data: beforeData, error: beforeError } = await supabase
    .from("matches")
    .select("id,home_team,away_team,start_time,prediction_open_at,prediction_close_at,status,deleted_at")
    .is("deleted_at", null)
    .neq("status", "encerrado");

  if (beforeError) throw beforeError;

  const beforeMatches = (beforeData ?? []) as MatchRow[];
  
  // Calculate and update statuses in TypeScript (RPC uses invalid status "aguardando")
  const updated: MatchStatusUpdate[] = [];
  const byStatus: Record<MatchStatus, number> = {
    aberto: 0,
    fechado: 0,
    ao_vivo: 0,
    encerrado: 0,
  };
  
  for (const match of beforeMatches) {
    const newStatus = calculateMatchStatus({
      prediction_close_at: match.prediction_close_at,
      prediction_open_at: match.prediction_open_at,
      start_time: match.start_time,
      status: match.status,
    }, now, 60);
    
    if (newStatus !== match.status) {
      const { error: updateError } = await supabase
        .from("matches")
        .update({ status: newStatus })
        .eq("id", match.id);
      
      if (updateError) {
        console.error(`Failed to update status for match ${match.id}:`, updateError.message);
        continue;
      }
      
      updated.push({
        from: match.status,
        matchId: match.id,
        name: `${match.home_team} x ${match.away_team}`,
        to: newStatus,
      });
      
      byStatus[newStatus]++;
    } else {
      byStatus[match.status]++;
    }
  }
  
  return {
    byStatus,
    checkedCount: beforeMatches.length,
    updated,
  };
};
