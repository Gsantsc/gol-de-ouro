import { useCallback, useEffect, useState } from "react";
import type { MatchEvent, MatchStatistics, Prediction } from "../shared";
import {
  getMatchStatistics,
  listMatchEvents,
  listMatchPredictions
} from "../services/football.service";
import { supabase } from "../services/supabase";

type PublicPrediction = Prediction & { user?: { name: string; email: string } };

export const useMatchDetails = (matchId?: string) => {
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [stats, setStats] = useState<MatchStatistics | null>(null);
  const [predictions, setPredictions] = useState<PublicPrediction[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!matchId) return;
    setLoading(true);
    const [nextStats, nextEvents, nextPredictions] = await Promise.all([
      getMatchStatistics(matchId),
      listMatchEvents(matchId),
      listMatchPredictions(matchId)
    ]);

    setStats(nextStats);
    setEvents(nextEvents);
    setPredictions(nextPredictions);
    setLoading(false);
  }, [matchId]);

  useEffect(() => {
    refresh().catch((error) => {
      console.error(error);
      setLoading(false);
    });
  }, [refresh]);

  useEffect(() => {
    if (!matchId) return;

    const channel = supabase
      .channel(`match-details-${matchId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "match_statistics", filter: `match_id=eq.${matchId}` },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "match_events", filter: `match_id=eq.${matchId}` },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "predictions", filter: `match_id=eq.${matchId}` },
        refresh,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId]);

  return { events, loading, predictions, refresh, stats };
};
