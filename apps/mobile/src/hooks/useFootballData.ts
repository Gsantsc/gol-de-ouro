import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  Achievement,
  AppSettings,
  AppInvite,
  Competition,
  CompetitionGroup,
  Group,
  GroupMember,
  Match,
  Notification,
  Player,
  Prediction,
  Ranking,
  Tournament
} from "../shared";
import {
  listAchievements,
  listAppInvites,
  listCompetitions,
  listGroupMembers,
  listMatches,
  listMyGroups,
  listMyPredictions,
  listNotifications,
  listPlayers,
  listRanking,
  getAppSettings,
  listTournaments
} from "../services/football.service";
import { supabase } from "../services/supabase";

type FootballDataSnapshot = {
  achievements: Achievement[];
  appInvites: AppInvite[];
  competitionGroups: CompetitionGroup[];
  competitions: Competition[];
  groupMembers: GroupMember[];
  groups: Group[];
  matches: Match[];
  notifications: Notification[];
  players: Player[];
  predictions: Prediction[];
  ranking: Ranking[];
  settings: AppSettings;
  tournaments: Tournament[];
};

const emptySnapshot: FootballDataSnapshot = {
  achievements: [],
  appInvites: [],
  competitionGroups: [],
  competitions: [],
  groupMembers: [],
  groups: [],
  matches: [],
  notifications: [],
  players: [],
  predictions: [],
  ranking: [],
  settings: { prediction_lock_minutes: 60 },
  tournaments: []
};

let footballDataCache: { userId: string; snapshot: FootballDataSnapshot; updatedAt: number } | null = null;

const withRetry = async <T,>(operation: () => Promise<T>, attempts = 3): Promise<T> => {
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
      }
    }
  }

  throw lastError;
};

const loadOptional = async <T,>(label: string, operation: () => Promise<T>, fallback: T): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    if (__DEV__) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[MOBILE DATA] ${label} unavailable. Using fallback.`, message);
    }
    return fallback;
  }
};

export const useFootballData = (userId?: string) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<FootballDataSnapshot>(emptySnapshot);

  const applySnapshot = useCallback((nextSnapshot: FootballDataSnapshot, nextUserId: string) => {
    footballDataCache = { userId: nextUserId, snapshot: nextSnapshot, updatedAt: Date.now() };
    setSnapshot(nextSnapshot);
  }, []);

  const refresh = useCallback(async () => {
    if (!userId) {
      footballDataCache = null;
      setSnapshot(emptySnapshot);
      setError(null);
      setLoading(false);
      return;
    }

    const cachedSnapshot = footballDataCache?.userId === userId ? footballDataCache.snapshot : null;
    if (cachedSnapshot) {
      setSnapshot(cachedSnapshot);
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      setError(null);
      const [
        nextTournaments,
        nextMatches,
        nextPredictions,
        nextRanking,
        nextGroups,
        nextGroupMembers,
        nextNotifications,
        nextPlayers,
        nextAppInvites,
        nextAchievements,
        nextCompetitionsData,
        nextSettings
      ] = await withRetry(() => Promise.all([
        listTournaments(),
        listMatches(),
        listMyPredictions(userId),
        listRanking(),
        listMyGroups(userId),
        listGroupMembers(),
        listNotifications(userId),
        listPlayers(),
        loadOptional("app_invites", () => listAppInvites(userId), []),
        loadOptional("achievements", () => listAchievements(userId), []),
        loadOptional("competitions", listCompetitions, { competitionGroups: [], competitions: [] }),
        getAppSettings()
      ]));

      applySnapshot({
        achievements: nextAchievements,
        appInvites: nextAppInvites,
        competitionGroups: nextCompetitionsData.competitionGroups,
        competitions: nextCompetitionsData.competitions,
        groupMembers: nextGroupMembers,
        groups: nextGroups,
        matches: nextMatches,
        notifications: nextNotifications,
        players: nextPlayers,
        predictions: nextPredictions,
        ranking: nextRanking,
        settings: nextSettings,
        tournaments: nextTournaments
      }, userId);
    } catch (nextError) {
      console.error(nextError);
      setError(nextError instanceof Error ? nextError.message : "Não foi possível carregar os dados.");
      if (cachedSnapshot) setSnapshot(cachedSnapshot);
    } finally {
      setLoading(false);
    }
  }, [applySnapshot, userId]);

  useEffect(() => {
    refresh().catch((error) => {
      console.error(error);
      setLoading(false);
    });
  }, [refresh]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel("app-live-data")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "rankings" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "match_events" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "groups" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "group_members" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "achievements" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "competitions" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "competition_groups" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "players" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "app_invites" }, refresh)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "predictions", filter: `user_id=eq.${userId}` },
        refresh,
      )
      .subscribe();

    // Fallback polling every 30 seconds
    const pollingInterval = setInterval(() => {
      refresh().catch((error) => {
        console.error('[POLLING] Error during fallback refresh:', error);
      });
    }, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollingInterval);
    };
  }, [refresh, userId]);

  const myRanking = useMemo(
    () => snapshot.ranking.find((item) => item.user_id === userId) ?? null,
    [snapshot.ranking, userId],
  );

  return {
    loading,
    error,
    achievements: snapshot.achievements,
    appInvites: snapshot.appInvites,
    competitionGroups: snapshot.competitionGroups,
    competitions: snapshot.competitions,
    groupMembers: snapshot.groupMembers,
    groups: snapshot.groups,
    matches: snapshot.matches,
    myRanking,
    notifications: snapshot.notifications,
    players: snapshot.players,
    predictions: snapshot.predictions,
    ranking: snapshot.ranking,
    refresh,
    settings: snapshot.settings,
    tournaments: snapshot.tournaments
  };
};
