import type { SupabaseClient } from "@supabase/supabase-js";

export type RankingUpdateResult = {
  matchId: string;
  scored: boolean;
};

// RANKING AUTO UPDATE
export const scoreFinishedMatchAndRefreshRanking = async (
  supabase: SupabaseClient,
  matchId: string,
): Promise<RankingUpdateResult> => {
  const { error } = await supabase.rpc("finish_match_and_score", { target_match_id: matchId });
  if (error) throw error;

  return {
    matchId,
    scored: true
  };
};
