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
import { Card, EmptyState, MetricTile, Pill, ScreenScroll, SectionTitle } from "../components/ui";
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
type PredictionRow = {
  category: PredictionCategory;
  displayStatus: ReturnType<typeof getPredictionDisplayStatus>;
  match: Match | null;
  prediction: Prediction;
};

const readDateTime = (value?: string | null) => {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};

const getPredictionCategoryPriority = (category: PredictionCategory) => {
  switch (category) {
    case "live":
      return 0;
    case "waiting":
      return 1;
    case "scored":
      return 2;
    case "unavailable":
      return 3;
  }
};

const sortPredictionRows = (rows: PredictionRow[], selectedCategory: CategoryFilter) => {
  return [...rows].sort((a, b) => {
    const priorityDiff =
      selectedCategory === "all"
        ? getPredictionCategoryPriority(a.category) - getPredictionCategoryPriority(b.category)
        : 0;

    if (priorityDiff !== 0) return priorityDiff;

    const aMatchTime = readDateTime(a.match?.start_time);
    const bMatchTime = readDateTime(b.match?.start_time);
    const aSubmittedAt = readDateTime(a.prediction.submitted_at);
    const bSubmittedAt = readDateTime(b.prediction.submitted_at);

    if (a.category === "scored" || a.category === "unavailable") {
      return bSubmittedAt - aSubmittedAt;
    }

    return aMatchTime - bMatchTime;
  });
};

const categoryFilters: Array<{ id: CategoryFilter; label: string }> = [
  { id: "all", label: "Todos" },
  { id: "scored", label: "Pontuados" },
  { id: "waiting", label: "Aguardando" },
  { id: "live", label: "Ao vivo" },
  { id: "unavailable", label: "Indisponiveis" }
];

export const PredictionsScreen = ({
  matches,
  onViewGames,
  players,
  predictions,
  ranking
}: {
  matches: Match[];
  onViewGames?: () => void;
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
  const nextRows =
    selectedCategory === "all"
      ? rows
      : rows.filter((row) => row.category === selectedCategory);

  return sortPredictionRows(nextRows, selectedCategory);
}, [rows, selectedCategory]);

  return (
    <ScreenScroll>
      <Card variant="hero">
        <View style={styles.headerCopy}>
          <Pill tone="gold">Central de palpites</Pill>
          <Text style={styles.headerTitle}>Meus Palpites</Text>
          <Text style={styles.headerBody}>
            Acompanhe status, pontos e extras escolhidos em cada partida.
          </Text>
        </View>

        <View style={styles.metrics}>
          <MetricTile icon={<Target color={colors.green} size={18} />} label="Enviados" value={safePredictions.length} />
          <MetricTile icon={<CheckCircle2 color={colors.gold} size={18} />} label="Pontuados" tone="gold" value={counts.scored} />
          <MetricTile icon={<Clock3 color={colors.blue} size={18} />} label="Pontos" tone="blue" value={performance.totalPoints} />
          <MetricTile icon={<RadioTower color={colors.gold} size={18} />} label="Aguardando" tone="gold" value={counts.waiting} />
        </View>
      </Card>

      {safePredictions.length ? (
        <>
          <SectionTitle title="Filtrar por status" />
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
          body="Voce ainda nao enviou nenhum palpite. Entre em Jogos, escolha uma partida disponivel e envie seu primeiro palpite."
          actionLabel={onViewGames ? "Ir para jogos" : undefined}
          onAction={onViewGames}
        />
      )}

      <View style={styles.bottomSpacer} />
    </ScreenScroll>
  );
};

const styles = StyleSheet.create({
  headerCopy: {
    gap: spacing.xs
  },
  headerTitle: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "900",
    lineHeight: 32
  },
  headerBody: {
    color: colors.mutedStrong,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 21
  },
  metrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.md
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
