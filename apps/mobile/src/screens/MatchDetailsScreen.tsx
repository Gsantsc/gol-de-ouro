import { StyleSheet, Text, View } from "react-native";
import { ArrowLeft, EyeOff } from "lucide-react-native";
import type { Match, Prediction } from "../shared";
import { EVENT_LABELS, formatFullDatePtBr, MATCH_STATUS_LABELS } from "../shared";
import { StatGrid } from "../components/StatGrid";
import { useMatchDetails } from "../hooks/useMatchDetails";
import { AppButton, Card, Pill, Screen, SectionTitle, Subtitle, Title } from "../components/ui";
import { colors, radius, spacing } from "../theme/tokens";

export const MatchDetailsScreen = ({
  match,
  myPrediction,
  onBack,
  onPredict
}: {
  match: Match;
  myPrediction?: Prediction;
  onBack: () => void;
  onPredict: () => void;
}) => {
  const { events, predictions, stats } = useMatchDetails(match.id);
  const showPublicPredictions = match.status === "encerrado";

  return (
    <Screen>
      <AppButton
        title="Voltar"
        onPress={onBack}
        variant="ghost"
        icon={<ArrowLeft color={colors.text} size={18} />}
      />

      <Card>
        <View style={styles.statusRow}>
          <Pill tone={match.status === "ao_vivo" ? "red" : match.status === "encerrado" ? "gold" : "green"}>
            {MATCH_STATUS_LABELS[match.status]}
          </Pill>
          <Text style={styles.date}>{formatFullDatePtBr(match.start_time)}</Text>
        </View>
        <View style={styles.scoreLine}>
          <Text style={styles.team}>{match.home_team}</Text>
          <View style={styles.scoreBox}>
            <Text style={styles.score}>{match.home_score}</Text>
            <Text style={styles.scoreMuted}>x</Text>
            <Text style={styles.score}>{match.away_score}</Text>
          </View>
          <Text style={[styles.team, styles.teamRight]}>{match.away_team}</Text>
        </View>
        {myPrediction ? (
          <View style={styles.mineBox}>
            <Text style={styles.mine}>Palpite enviado</Text>
            <Text style={styles.mineHint}>Detalhes completos ficam na aba Palpites.</Text>
          </View>
        ) : (
          <AppButton title="Enviar palpite" onPress={onPredict} />
        )}
      </Card>

      <SectionTitle title="Estatísticas" />
      <Card>
        <StatGrid stats={stats} />
      </Card>

      <SectionTitle title="Timeline" />
      <Card>
        {events.length ? (
          events.map((event) => (
            <View key={event.id} style={styles.eventRow}>
              <Text style={styles.minute}>{event.minute}'</Text>
              <Text style={styles.eventType}>{EVENT_LABELS[event.type]}</Text>
              <Text style={styles.eventDescription}>{event.description}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.muted}>Sem eventos registrados.</Text>
        )}
      </Card>

      <SectionTitle title="Palpites enviados" />
      <Card>
        {showPublicPredictions ? (
          predictions.length ? (
            predictions.map((prediction) => (
              <View key={prediction.id} style={styles.predictionRow}>
                <Text style={styles.predictionName}>{prediction.user?.name ?? "Participante"}</Text>
                <Text style={styles.predictionScore}>Pontuado</Text>
              </View>
            ))
          ) : (
            <Text style={styles.muted}>Nenhum palpite enviado para esta partida.</Text>
          )
        ) : (
          <View style={styles.secret}>
            <EyeOff color={colors.gold} size={20} />
            <Text style={styles.secretText}>
              Os palpites dos outros participantes serão revelados após o encerramento da partida.
            </Text>
          </View>
        )}
      </Card>
    </Screen>
  );
};

const styles = StyleSheet.create({
  statusRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm
  },
  date: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700"
  },
  scoreLine: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    marginVertical: spacing.lg
  },
  team: {
    color: colors.text,
    flex: 1,
    fontSize: 20,
    fontWeight: "900"
  },
  teamRight: {
    textAlign: "right"
  },
  scoreBox: {
    alignItems: "center",
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    minWidth: 108,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  score: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "900"
  },
  scoreMuted: {
    color: colors.muted,
    fontSize: 16,
    fontWeight: "900"
  },
  mine: {
    color: colors.gold,
    fontWeight: "900"
  },
  mineBox: {
    backgroundColor: "rgba(212, 175, 55, 0.1)",
    borderColor: "rgba(246, 211, 101, 0.18)",
    borderRadius: radius.sm,
    borderWidth: 1,
    gap: 4,
    padding: spacing.sm
  },
  mineHint: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700"
  },
  eventRow: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    paddingVertical: spacing.sm
  },
  minute: {
    color: colors.gold,
    fontSize: 14,
    fontWeight: "900",
    width: 38
  },
  eventType: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900",
    width: 118
  },
  eventDescription: {
    color: colors.muted,
    flex: 1
  },
  predictionRow: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.sm
  },
  predictionName: {
    color: colors.text,
    fontWeight: "800"
  },
  predictionScore: {
    color: colors.gold,
    fontSize: 16,
    fontWeight: "900"
  },
  secret: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm
  },
  secretText: {
    color: colors.muted,
    flex: 1,
    lineHeight: 21
  },
  muted: {
    color: colors.muted
  }
});
