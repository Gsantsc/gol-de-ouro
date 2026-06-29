import { StyleSheet, Text, View } from "react-native";
import { ArrowLeft, EyeOff } from "lucide-react-native";
import type { Match, Prediction } from "../shared";
import {
  EVENT_LABELS,
  formatFullDatePtBr,
  formatTeamDisplayName,
  getSeedLabel,
  isKnockoutPlaceholder,
  MATCH_STATUS_LABELS
} from "../shared";
import { TeamFlag } from "../components/TeamFlag";
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
  const homeUndefined = isKnockoutPlaceholder(match.home_team);
  const awayUndefined = isKnockoutPlaceholder(match.away_team);
  const hasUndefinedTeams = homeUndefined || awayUndefined;
  const homeSeedLabel = getSeedLabel(match.home_team);
  const awaySeedLabel = getSeedLabel(match.away_team);

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
          <View style={styles.teamSide}>
            <TeamFlag logoUrl={homeUndefined ? null : match.home_team_logo_url} name={formatTeamDisplayName(match.home_team)} size={34} />
            <Text style={styles.team}>{formatTeamDisplayName(match.home_team)}</Text>
            {homeSeedLabel ? <Text style={styles.seedLabel}>{homeSeedLabel}</Text> : null}
          </View>
          <View style={styles.scoreBox}>
            <Text style={styles.score}>{match.home_score}</Text>
            <Text style={styles.scoreMuted}>x</Text>
            <Text style={styles.score}>{match.away_score}</Text>
          </View>
          <View style={[styles.teamSide, styles.teamSideRight]}>
            <TeamFlag logoUrl={awayUndefined ? null : match.away_team_logo_url} name={formatTeamDisplayName(match.away_team)} size={34} />
            <Text style={[styles.team, styles.teamRight]}>{formatTeamDisplayName(match.away_team)}</Text>
            {awaySeedLabel ? <Text style={[styles.seedLabel, styles.seedLabelRight]}>{awaySeedLabel}</Text> : null}
          </View>
        </View>
        {hasUndefinedTeams ? (
          <View style={styles.undefinedTeamsBox}>
            <Text style={styles.undefinedTeamsTitle}>Times ainda nao definidos para esta partida.</Text>
            <Text style={styles.undefinedTeamsText}>Aguarde a definicao dos classificados para enviar seu palpite.</Text>
          </View>
        ) : null}
        {myPrediction ? (
          <View style={styles.mineBox}>
            <Text style={styles.mine}>Palpite enviado</Text>
            <Text style={styles.mineHint}>Detalhes completos ficam na aba Palpites.</Text>
          </View>
        ) : (
          <AppButton disabled={hasUndefinedTeams} title={hasUndefinedTeams ? "Times ainda nao definidos" : "Enviar palpite"} onPress={onPredict} />
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
  teamSide: {
    alignItems: "center",
    flex: 1,
    gap: spacing.xs
  },
  teamSideRight: {
    alignItems: "flex-end"
  },
  team: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center"
  },
  teamRight: {
    textAlign: "right"
  },
  seedLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "800",
    textAlign: "center"
  },
  seedLabelRight: {
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
  undefinedTeamsBox: {
    backgroundColor: "rgba(212, 175, 55, 0.10)",
    borderColor: "rgba(246, 211, 101, 0.22)",
    borderRadius: radius.sm,
    borderWidth: 1,
    gap: 4,
    marginBottom: spacing.md,
    padding: spacing.sm
  },
  undefinedTeamsTitle: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: "900"
  },
  undefinedTeamsText: {
    color: colors.mutedStrong,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18
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
