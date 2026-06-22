import { StyleSheet, Text, View } from "react-native";
import { CheckCircle2, Clock3, Target } from "lucide-react-native";
import type { Match, Player, Prediction, PredictionWinner, Ranking } from "../shared";
import { calculateMatchStatus, deriveUserPerformance, formatDateTimePtBr, formatMatchupDisplayName, getPredictionDisplayStatus, getPredictionStatusLabel, getPredictionStatusTone, getTeamDisplayName } from "../shared";
import { Card, EmptyState, MetricTile, Pill, ScreenScroll, SectionTitle } from "../components/ui";
import { colors, radius, spacing } from "../theme/tokens";

const winnerLabel = (winner?: PredictionWinner | null, match?: Match) => {
  if (winner === "home") return getTeamDisplayName(match?.home_team) || "Casa";
  if (winner === "away") return getTeamDisplayName(match?.away_team) || "Visitante";
  if (winner === "draw") return "Empate";
  return "-";
};

const boolLabel = (value?: boolean | null) => {
  if (value === true) return "Sim";
  if (value === false) return "Nao";
  return "-";
};

const marketText = (value?: string | null) => value?.trim() || "-";

export const PredictionsScreen = ({
  matches,
  players,
  predictionLockMinutes,
  predictions,
  ranking
}: {
  matches: Match[];
  players: Player[];
  predictionLockMinutes: number;
  predictions: Prediction[];
  ranking: Ranking | null;
}) => {
  const performance = deriveUserPerformance({ matches, predictions, ranking });
  const playerById = new Map(players.map((player) => [player.id, player]));
  const rows = predictions.map((prediction) => {
    const match = matches.find((item) => item.id === prediction.match_id);
    const displayStatus = getPredictionDisplayStatus(prediction, match);
    const category = getPredictionCategory(prediction, match);
    
    return { category, displayStatus, match, prediction };
  });
  
  const allCount = rows.length;
  const scoredCount = rows.filter(row => row.category === "scored").length;
  const waitingCount = rows.filter(row => row.category === "waiting").length;
  const liveCount = rows.filter(row => row.category === "live").length;
  
  const sections = [
    { title: "Todos", count: allCount, filter: () => rows },
    { title: "Pontuados", count: scoredCount, filter: () => rows.filter(row => row.category === "scored") },
    { title: "Aguardando", count: waitingCount, filter: () => rows.filter(row => row.category === "waiting") },
    { title: "Ao vivo", count: liveCount, filter: () => rows.filter(row => row.category === "live") }
  ];

  return (
    <ScreenScroll>
      <SectionTitle title="Meus Palpites" />
      <View style={styles.metrics}>
        <MetricTile icon={<Target color={colors.green} size={18} />} label="Enviados" value={predictions.length} />
        <MetricTile icon={<CheckCircle2 color={colors.gold} size={18} />} label="Pontuaram" tone="gold" value={performance.correctResults} />
        <MetricTile icon={<Clock3 color={colors.blue} size={18} />} label="Pontos" tone="blue" value={performance.totalPoints} />
      </View>

      {predictions.length ? (
        sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <SectionTitle title={`${section.title}: ${section.count}`} />
            <Card>
              {section.filter().length ? (
                section.filter().map(({ match, prediction, displayStatus }) => {
                  const statusLabel = getPredictionStatusLabel(displayStatus);
                  const statusTone = getPredictionStatusTone(displayStatus);

                  return (
                    <View key={prediction.id} style={styles.row}>
                      <View style={styles.content}>
                        <Text numberOfLines={1} style={styles.match}>
                          {match ? formatMatchupDisplayName(match.home_team, match.away_team) : "Partida indisponivel"}
                        </Text>
                        <Text style={styles.date}>
                          {match ? formatDateTimePtBr(match.start_time) : "Data indisponivel"}
                        </Text>
                        <View style={styles.status}>
                          <Pill tone={statusTone}>{statusLabel}</Pill>
                        </View>
                        <View style={styles.detailsGrid}>
                          <PredictionDetail label="Vencedor" value={winnerLabel(prediction.predicted_winner, match)} />
                          <PredictionDetail
                            label="Primeiro gol"
                            value={
                              prediction.predicted_first_goal_no_goals
                                ? "Sem gols"
                                : playerById.get(prediction.predicted_first_scorer_id ?? "")?.name ?? marketText(prediction.predicted_first_scorer)
                            }
                          />
                          <PredictionDetail label="Ambos" value={boolLabel(prediction.predicted_both_teams_score)} />
                          <PredictionDetail
                            label="MVP"
                            value={playerById.get(prediction.predicted_man_of_match_id ?? "")?.name ?? marketText(prediction.predicted_man_of_match)}
                          />
                          <PredictionDetail label="Vermelho" value={boolLabel(prediction.predicted_red_card)} />
                        </View>
                      </View>
                      <View style={styles.scoreBox}>
                        <Text style={styles.score}>
                          {prediction.predicted_home_score} x {prediction.predicted_away_score}
                        </Text>
                        <Text style={styles.points}>{prediction.points} pts</Text>
                      </View>
                    </View>
                  );
                })
              ) : (
                <Text style={styles.emptyText}>Nenhum palpite nesta categoria.</Text>
              )}
            </Card>
          </View>
        ))
      ) : (
        <EmptyState
          title="Sem palpites"
          body="Quando voce enviar um palpite, ele aparece aqui com placar, status e pontos."
        />
      )}
    </ScreenScroll>
  );
};

const PredictionDetail = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.detail}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text numberOfLines={1} style={styles.detailValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  metrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  section: {
    gap: spacing.xs
  },
  row: {
    alignItems: "flex-start",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 78,
    paddingVertical: spacing.sm
  },
  content: {
    flex: 1
  },
  match: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900"
  },
  date: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4
  },
  status: {
    marginTop: spacing.xs
  },
  detailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.sm
  },
  detail: {
    backgroundColor: "rgba(11, 15, 25, 0.36)",
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    minWidth: 94,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs
  },
  detailLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  detailValue: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2
  },
  scoreBox: {
    alignItems: "flex-end",
    backgroundColor: "rgba(255,255,255,0.035)",
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    gap: 2,
    minWidth: 78,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  score: {
    color: colors.gold,
    fontSize: 20,
    fontWeight: "900"
  },
  points: {
    color: colors.green,
    fontSize: 12,
    fontWeight: "900"
  },
  emptyText: {
    color: colors.muted,
    lineHeight: 21
  }
});
