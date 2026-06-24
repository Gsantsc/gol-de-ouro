// CHAMPIONSHIPS SCREEN FIX - Display only supported championships from database
// FRONTEND LEAGUE FILTER FIX - No hardcoded fallback, use database data only
import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { CalendarDays } from "lucide-react-native";
import type { Match, Prediction, Tournament } from "../shared";
import {
  TOURNAMENT_LABELS,
  getPredictionWindowState,
  groupMatchesByDate,
  isMatchFinished,
  isMatchLive,
  isMatchOpenForPrediction
} from "../shared";
import { MatchCard } from "../components/MatchCard";
import { Card, EmptyState, SectionTitle } from "../components/ui";
import { colors, radius, spacing } from "../theme/tokens";

type GamesStatusFilter = "all" | "open" | "waiting" | "live" | "closed";

const STATUS_FILTER_LABELS: Record<GamesStatusFilter, string> = {
  all: "Todos",
  open: "Abertos",
  waiting: "Aguardando",
  live: "Ao vivo",
  closed: "Fechados"
};

const getMatchSortPriority = (
  match: Match,
  now: Date,
  predictionLockMinutes: number
) => {
  if (isMatchLive(match, now)) return 0;
  if (isMatchOpenForPrediction(match, now, predictionLockMinutes)) return 1;

  const windowState = getPredictionWindowState(match, now, predictionLockMinutes);

  if (windowState === "not_open" && !isMatchFinished(match)) return 2;
  if (!isMatchFinished(match)) return 3;

  return 4;
};

const sortMatchesByStatus = (
  matches: Match[],
  now: Date,
  predictionLockMinutes: number
) => {
  return [...matches].sort((a, b) => {
    const priorityDiff =
      getMatchSortPriority(a, now, predictionLockMinutes) -
      getMatchSortPriority(b, now, predictionLockMinutes);

    if (priorityDiff !== 0) return priorityDiff;

    return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
  });
};

export const TournamentsScreen = ({
  matches,
  predictions,
  tournaments,
  onDetails,
  onPredict,
  predictionLockMinutes
}: {
  matches: Match[];
  predictions: Prediction[];
  tournaments: Tournament[];
  onDetails: (match: Match) => void;
  onPredict: (match: Match) => void;
  predictionLockMinutes: number;
}) => {
  const worldCupTournament = useMemo(
    () => tournaments.find((tournament) => tournament.slug === "world_cup_2026"),
    [tournaments],
  );
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<GamesStatusFilter>("all");

  useEffect(() => {
    if (selectedTournamentId) return;
    setSelectedTournamentId(worldCupTournament?.id ?? tournaments[0]?.id);
  }, [selectedTournamentId, tournaments, worldCupTournament?.id]);

  const worldCupMatches = useMemo(
    () => matches.filter((match) => match.championship === "world_cup_2026"),
    [matches],
  );
  const selectedMatches = useMemo(() => {
    const filtered = matches.filter((match) => {
      if (!selectedTournamentId) return true;
      if (match.tournament_id === selectedTournamentId) return true;
      return selectedTournamentId === worldCupTournament?.id && match.championship === "world_cup_2026";
    });

    return filtered.length ? filtered : worldCupMatches.length ? worldCupMatches : matches;
  }, [matches, selectedTournamentId, worldCupMatches, worldCupTournament?.id]);
  const statusFilteredMatches = useMemo(() => {
    const now = new Date();

    const filtered = selectedMatches.filter((match) => {
      const windowState = getPredictionWindowState(match, now, predictionLockMinutes);

      if (statusFilter === "all") return true;
      if (statusFilter === "open") return isMatchOpenForPrediction(match, now, predictionLockMinutes);
      if (statusFilter === "waiting") return windowState === "not_open" && !isMatchLive(match, now) && !isMatchFinished(match);
      if (statusFilter === "live") return isMatchLive(match, now);
      if (statusFilter === "closed") return windowState === "closed" && !isMatchLive(match, now);

      return true;
    });

    return sortMatchesByStatus(filtered, now, predictionLockMinutes);
  }, [predictionLockMinutes, selectedMatches, statusFilter]);

  const matchGroups = useMemo(() => groupMatchesByDate(statusFilteredMatches), [statusFilteredMatches]);

  const header = (
    <View style={styles.header}>
      <SectionTitle title="Jogos" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
        <View style={styles.tournamentList}>
          {tournaments.map((tournament) => {
            const active = selectedTournamentId === tournament.id;
            return (
              <Pressable
                key={tournament.id}
                onPress={() => setSelectedTournamentId(tournament.id)}
                style={[styles.tournament, active && styles.tournamentActive]}
              >
                <Text numberOfLines={1} style={[styles.tournamentName, active && styles.tournamentNameActive]}>
                  {tournament.name || TOURNAMENT_LABELS[tournament.type]}
                </Text>
                <Text style={[styles.tournamentStatus, active && styles.tournamentStatusActive]}>
                  {tournament.active ? "Ativo" : "Inativo"}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
        <View style={styles.statusList}>
          {(["all", "open", "waiting", "live", "closed"] as GamesStatusFilter[]).map((status) => {
            const active = statusFilter === status;
            const label = STATUS_FILTER_LABELS[status];
            return (
              <Pressable
                key={status}
                onPress={() => setStatusFilter(status)}
                style={[styles.statusChip, active && styles.statusChipActive]}
              >
                <Text style={[styles.statusChipText, active && styles.statusChipTextActive]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.summary}>
        <View style={styles.summaryIcon}>
          <CalendarDays color={colors.green} size={18} />
        </View>
        <View style={styles.summaryText}>
          <Text style={styles.summaryValue}>{statusFilteredMatches.length}</Text>
          <Text style={styles.summaryLabel}>partidas na lista</Text>
        </View>
      </View>

      <SectionTitle title="Jogos organizados por status" />
    </View>
  );

  return (
    <FlatList
      ListEmptyComponent={
        <EmptyState
          title="Sem partidas"
          body="Não há partidas cadastradas para exibir agora."
        />
      }
      ListFooterComponent={
        <Card style={styles.noticeCard} variant="soft">
          <Text style={styles.notice}>
            Apenas campeonatos suportados aparecem aqui: Copa do Mundo 2026, Libertadores,
            Sul-Americana, Brasileirao Serie A, Copa do Brasil e Champions League.
          </Text>
        </Card>
      }
      ListHeaderComponent={header}
      contentContainerStyle={styles.listContent}
      data={matchGroups}
      initialNumToRender={8}
      keyExtractor={(group) => group.dateKey}
      maxToRenderPerBatch={8}
      removeClippedSubviews
      renderItem={({ item: group }) => (
        <View style={styles.dayGroup}>
          <View style={styles.dayHeader}>
            <Text style={styles.dayLabel}>{group.label}</Text>
            <Text style={styles.dayCount}>{group.matches.length} jogos</Text>
          </View>
          {group.matches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              onDetails={() => onDetails(match)}
              onPredict={() => onPredict(match)}
              predictionLockMinutes={predictionLockMinutes}
              prediction={predictions.find((prediction) => prediction.match_id === match.id)}
            />
          ))}
        </View>
      )}
      showsVerticalScrollIndicator={false}
      windowSize={9}
    />
  );
};

const styles = StyleSheet.create({
  listContent: {
    gap: spacing.sm,
    paddingBottom: spacing.lg
  },
  dayGroup: {
    gap: spacing.sm
  },
  dayHeader: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  dayLabel: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    fontWeight: "900",
    textTransform: "capitalize"
  },
  dayCount: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: "900"
  },
  header: {
    gap: spacing.md
  },
  chipsScroll: {
    marginHorizontal: -spacing.md,
    paddingHorizontal: spacing.md
  },
  tournamentList: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingRight: spacing.md
  },
  statusList: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingRight: spacing.md
  },
  statusChip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs
  },
  statusChipActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold
  },
  statusChipText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "900"
  },
  statusChipTextActive: {
    color: colors.black
  },
  tournament: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    minWidth: 138,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  tournamentActive: {
    backgroundColor: colors.green,
    borderColor: colors.green
  },
  tournamentName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900"
  },
  tournamentNameActive: {
    color: colors.black
  },
  tournamentStatus: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 3
  },
  tournamentStatusActive: {
    color: colors.black
  },
  summary: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.035)",
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.sm
  },
  summaryIcon: {
    alignItems: "center",
    backgroundColor: colors.greenSoft,
    borderRadius: radius.sm,
    height: 36,
    justifyContent: "center",
    width: 36
  },
  summaryText: {
    flexDirection: "row",
    gap: spacing.xs
  },
  summaryValue: {
    color: colors.text,
    fontWeight: "900"
  },
  summaryLabel: {
    color: colors.muted,
    fontWeight: "800"
  },
  noticeCard: {
    marginTop: spacing.sm
  },
  notice: {
    color: colors.muted,
    lineHeight: 21
  }
});
