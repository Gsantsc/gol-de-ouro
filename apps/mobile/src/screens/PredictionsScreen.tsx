import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { CheckCircle2, Clock3, RadioTower, Target } from "lucide-react-native";
import type { Match, Player, Prediction, Ranking } from "../shared";
import {
  deriveUserPerformance,
  formatDateTimePtBr,
  getPredictionCategory,
  getPredictionDisplayStatus,
  type PredictionCategory
} from "../shared";
import { PredictionCard } from "../components/PredictionCard";
import { Card, EmptyState, MetricTile, ScreenScroll, SectionTitle } from "../components/ui";
import { colors, radius, spacing } from "../theme/tokens";

type CategoryFilter = "all" | PredictionCategory;

const safeFormatDateTime = (value?: string | null) => {
  if (!value) return "Data indisponivel";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data indisponivel";
  return formatDateTimePtBr(value);
};

const getPredictionMatch = (prediction: Prediction, matches: Match[]) =>
  matches.find((item) => item.id === prediction.match_id) ?? null;

const categoryFilters: Array<{ id: CategoryFilter; label: string }> = [
  { id: "all", label: "Todos" },
  { id: "scored", label: "Pontuados" },
  { id: "waiting", label: "Aguardando" },
  { id: "live", label: "Ao vivo" },
  { id: "unavailable", label: "Indisponiveis" }
];

export const PredictionsScreen = ({
  matches,
  players,
  predictions,
  ranking
}: {
  matches: Match[];
  players: Player[];
  predictionLockMinutes: number;
  predictions: Prediction[];
  ranking: Ranking | null;
}) => {
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>("all");

  const safeMatches = Array.isArray(matches) ? matches : [];
  const safePlayers = Array.isArray(players) ? players : [];
  const safePredictions = Array.isArray(predictions) ? predictions : [];

  const performance = deriveUserPerformance({
    matches: safeMatches,
    predictions: safePredictions,
    ranking
  });
  const playerById = new Map(safePlayers.map((player) => [player.id, player]));

  const rows = useMemo(
    () => safePredictions.map((prediction) => {
      const match = getPredictionMatch(prediction, safeMatches);
      return {
        category: getPredictionCategory(prediction, match),
        displayStatus: getPredictionDisplayStatus(prediction, match),
        match,
        prediction
      };
    }),
    [safeMatches, safePredictions]
  );

  const counts = useMemo(() => ({
    all: rows.length,
    live: rows.filter((row) => row.category === "live").length,
    scored: rows.filter((row) => row.category === "scored").length,
    unavailable: rows.filter((row) => row.category === "unavailable").length,
    waiting: rows.filter((row) => row.category === "waiting").length
  }), [rows]);

  const visibleFilters = categoryFilters.filter((filter) =>
    filter.id !== "unavailable" || counts.unavailable > 0
  );

  const filteredRows = useMemo(() => {
    if (selectedCategory === "all") return rows;
    return rows.filter((row) => row.category === selectedCategory);
  }, [rows, selectedCategory]);

  return (
    <ScreenScroll>
      <SectionTitle title="Meus Palpites" />

      <View style={styles.metrics}>
        <MetricTile icon={<Target color={colors.green} size={18} />} label="Enviados" value={safePredictions.length} />
        <MetricTile icon={<CheckCircle2 color={colors.gold} size={18} />} label="Processados" tone="gold" value={counts.scored} />
        <MetricTile icon={<Clock3 color={colors.blue} size={18} />} label="Pontos" tone="blue" value={performance.totalPoints} />
        <MetricTile icon={<RadioTower color={colors.gold} size={18} />} label="Aguardando" tone="gold" value={counts.waiting} />
      </View>

      {safePredictions.length ? (
        <>
          <ScrollView
            contentContainerStyle={styles.filterRow}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {visibleFilters.map((filter) => {
              const active = selectedCategory === filter.id;
              const count = counts[filter.id];

              return (
                <Pressable
                  key={filter.id}
                  accessibilityRole="button"
                  onPress={() => setSelectedCategory(filter.id)}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                >
                  <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                    {filter.label}
                  </Text>
                  <View style={[styles.filterChipBadge, active && styles.filterChipBadgeActive]}>
                    <Text style={[styles.filterChipCount, active && styles.filterChipCountActive]}>{count}</Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          {filteredRows.length ? (
            <View style={styles.cardsList}>
              {filteredRows.map(({ match, prediction, displayStatus }) => (
                <PredictionCard
                  key={prediction.id}
                  displayStatus={displayStatus}
                  formattedDate={safeFormatDateTime(match?.start_time ?? prediction.submitted_at)}
                  match={match}
                  playerById={playerById}
                  prediction={prediction}
                />
              ))}
            </View>
          ) : (
            <Card variant="soft">
              <Text style={styles.emptyText}>Nenhum palpite nesta categoria.</Text>
            </Card>
          )}
        </>
      ) : (
        <EmptyState
          title="Sem palpites"
          body="Quando voce enviar um palpite, ele aparece aqui com placar, status e pontos."
        />
      )}

      <View style={styles.bottomSpacer} />
    </ScreenScroll>
  );
};

const styles = StyleSheet.create({
  metrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  filterRow: {
    gap: spacing.xs,
    paddingVertical: spacing.xs
  },
  filterChip: {
    alignItems: "center",
    backgroundColor: colors.surfaceDeep,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.xs,
    marginRight: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  filterChipActive: {
    backgroundColor: colors.goldSoft,
    borderColor: colors.borderGoldStrong
  },
  filterChipText: {
    color: colors.mutedStrong,
    fontSize: 13,
    fontWeight: "800"
  },
  filterChipTextActive: {
    color: colors.text
  },
  filterChipBadge: {
    alignItems: "center",
    backgroundColor: colors.whiteSoft,
    borderRadius: radius.pill,
    justifyContent: "center",
    minWidth: 24,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2
  },
  filterChipBadgeActive: {
    backgroundColor: "rgba(5, 7, 13, 0.42)"
  },
  filterChipCount: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "900"
  },
  filterChipCountActive: {
    color: colors.gold
  },
  cardsList: {
    gap: spacing.sm
  },
  emptyText: {
    color: colors.muted,
    lineHeight: 21
  },
  bottomSpacer: {
    height: spacing.xl
  }
});
