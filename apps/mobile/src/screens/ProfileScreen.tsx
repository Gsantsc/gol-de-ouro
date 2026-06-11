import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Flame, LogOut, Medal, MessageCircle, Send, Target, Trophy } from "lucide-react-native";
import type { Achievement, BetaFeedbackType, Match, Prediction, Ranking } from "../shared";
import { deriveUserPerformance } from "../shared";
import { useAuth } from "../hooks/useAuth";
import { AppButton, Card, MetricTile, ScreenScroll, SectionTitle, Subtitle, Title } from "../components/ui";
import { colors, radius, spacing } from "../theme/tokens";
import { submitBetaFeedback } from "../services/football.service";
import { AchievementsScreen } from "./AchievementsScreen";

const weekLabel = (index: number) => `S${index + 1}`;
const feedbackTypes: Array<{ label: string; value: BetaFeedbackType }> = [
  { label: "Reportar problema", value: "problem" },
  { label: "Enviar sugestão", value: "suggestion" }
];

export const ProfileScreen = ({
  achievements,
  matches,
  predictions,
  ranking,
  position
}: {
  achievements: Achievement[];
  matches: Match[];
  predictions: Prediction[];
  ranking: Ranking | null;
  position: number | null;
}) => {
  const { profile, signOut } = useAuth();
  const [feedbackType, setFeedbackType] = useState<BetaFeedbackType>("problem");
  const [feedbackDescription, setFeedbackDescription] = useState("");
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const performance = deriveUserPerformance({ matches, predictions, ranking });
  const weeklyEvolution = useMemo(() => {
    const buckets = Array.from({ length: 6 }, (_, index) => ({ label: weekLabel(index), points: 0 }));
    const now = Date.now();
    predictions.forEach((prediction) => {
      const submittedAt = new Date(prediction.submitted_at).getTime();
      const diffWeeks = Math.floor((now - submittedAt) / (7 * 24 * 60 * 60 * 1000));
      const bucketIndex = 5 - Math.min(5, Math.max(0, diffWeeks));
      buckets[bucketIndex].points += prediction.points;
    });
    return buckets;
  }, [predictions]);
  const maxWeeklyPoints = Math.max(1, ...weeklyEvolution.map((item) => item.points));

  const sendFeedback = async () => {
    if (!profile || feedbackSubmitting) return;

    try {
      setFeedbackSubmitting(true);
      setFeedbackMessage(null);
      await submitBetaFeedback({
        description: feedbackDescription,
        type: feedbackType,
        userId: profile.id
      });
      setFeedbackDescription("");
      setFeedbackMessage("Feedback enviado. Obrigado por ajudar no beta fechado.");
    } catch (error) {
      setFeedbackMessage(error instanceof Error ? error.message : "Não foi possível enviar o feedback.");
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  return (
    <ScreenScroll>
      <Card variant="accent">
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(profile?.name ?? "GO")
                .split(" ")
                .map((part) => part[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </Text>
          </View>
          <View style={styles.headerText}>
            <Title>{profile?.name ?? "Perfil"}</Title>
            <Subtitle>{profile?.email}</Subtitle>
          </View>
        </View>
        <View style={styles.stats}>
          <MetricTile icon={<Medal color={colors.gold} size={18} />} label="Ranking" tone="gold" value={position ? `#${position}` : "-"} />
          <MetricTile icon={<Trophy color={colors.green} size={18} />} label="Pontos" value={performance.totalPoints} />
          <MetricTile icon={<Target color={colors.blue} size={18} />} label="Taxa de acerto" tone="blue" value={`${performance.hitRate}%`} />
          <MetricTile icon={<Flame color={colors.red} size={18} />} label="Streak" tone="red" value={performance.currentStreak} />
        </View>
        <AppButton icon={<LogOut color={colors.text} size={16} />} title="Sair" onPress={signOut} variant="ghost" />
      </Card>

      <SectionTitle title="Progresso" />
      <Card>
        <View style={styles.progressGrid}>
          <ProgressItem label="Placares exatos" value={performance.exactScores} />
          <ProgressItem label="Jogos avaliados" value={performance.finishedPredictions} />
          <ProgressItem label="Palpites enviados" value={performance.totalPredictions} />
          <ProgressItem label="Acertos" value={performance.correctResults} />
        </View>
        <View style={styles.chart}>
          {weeklyEvolution.map((item) => (
            <View key={item.label} style={styles.chartColumn}>
              <View style={styles.barTrack}>
                <View style={[styles.bar, { height: `${Math.max(8, (item.points / maxWeeklyPoints) * 100)}%` }]} />
              </View>
              <Text style={styles.chartLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
      </Card>

      <AchievementsScreen achievements={achievements} />

      <SectionTitle title="Palpites" />
      <Card>
        <Text style={styles.profileNote}>
          Você tem {predictions.length} palpite(s) enviado(s). Os placares, pontos e resultados ficam organizados na aba Palpites.
        </Text>
      </Card>
      <SectionTitle title="Beta fechado" />
      <Card>
        <View style={styles.feedbackHeader}>
          <View style={styles.feedbackIcon}>
            <MessageCircle color={colors.gold} size={18} />
          </View>
          <View style={styles.feedbackCopy}>
            <Text style={styles.feedbackTitle}>Ajude a melhorar o Gol de Ouro</Text>
            <Text style={styles.feedbackBody}>Reporte problema ou envie sugestão direto para o time.</Text>
          </View>
        </View>
        <View style={styles.feedbackTabs}>
          {feedbackTypes.map((item) => {
            const active = item.value === feedbackType;
            return (
              <Pressable
                key={item.value}
                onPress={() => setFeedbackType(item.value)}
                style={[styles.feedbackTab, active && styles.feedbackTabActive]}
              >
                <Text style={[styles.feedbackTabText, active && styles.feedbackTabTextActive]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <TextInput
          multiline
          onChangeText={setFeedbackDescription}
          placeholder="Conte o que aconteceu ou o que poderia melhorar."
          placeholderTextColor={colors.placeholder}
          style={styles.feedbackInput}
          textAlignVertical="top"
          value={feedbackDescription}
        />
        {feedbackMessage ? <Text style={styles.feedbackMessage}>{feedbackMessage}</Text> : null}
        <AppButton
          disabled={feedbackDescription.trim().length < 8}
          icon={<Send color={colors.black} size={16} />}
          loading={feedbackSubmitting}
          onPress={sendFeedback}
          title="Enviar feedback"
        />
      </Card>
    </ScreenScroll>
  );
};

const ProgressItem = ({ label, value }: { label: string | number; value: string | number }) => (
  <View style={styles.progressItem}>
    <Text style={styles.progressValue}>{value}</Text>
    <Text style={styles.progressLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md
  },
  avatar: {
    alignItems: "center",
    backgroundColor: colors.gold,
    borderColor: colors.goldHighlight,
    borderRadius: radius.sm,
    borderWidth: 1,
    height: 60,
    justifyContent: "center",
    width: 60
  },
  avatarText: {
    color: colors.black,
    fontSize: 20,
    fontWeight: "900"
  },
  headerText: {
    flex: 1,
    gap: 4
  },
  stats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginVertical: spacing.md
  },
  progressGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  progressItem: {
    backgroundColor: "rgba(255,255,255,0.035)",
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexBasis: "47%",
    flexGrow: 1,
    padding: spacing.sm
  },
  progressValue: {
    color: colors.gold,
    fontSize: 22,
    fontWeight: "900"
  },
  progressLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 3
  },
  profileNote: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 21
  },
  feedbackHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm
  },
  feedbackIcon: {
    alignItems: "center",
    backgroundColor: colors.goldSoft,
    borderColor: colors.borderGoldStrong,
    borderRadius: radius.sm,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    width: 42
  },
  feedbackCopy: {
    flex: 1
  },
  feedbackTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900"
  },
  feedbackBody: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    marginTop: 3
  },
  feedbackTabs: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md
  },
  feedbackTab: {
    alignItems: "center",
    backgroundColor: colors.whiteSoft,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: spacing.sm
  },
  feedbackTabActive: {
    backgroundColor: colors.goldSoft,
    borderColor: colors.borderGoldStrong
  },
  feedbackTabText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "900",
    textAlign: "center"
  },
  feedbackTabTextActive: {
    color: colors.gold
  },
  feedbackInput: {
    backgroundColor: colors.surfaceDeep,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 21,
    marginTop: spacing.md,
    minHeight: 112,
    padding: spacing.md
  },
  feedbackMessage: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19,
    marginVertical: spacing.sm
  },
  chart: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: spacing.sm,
    height: 120,
    marginTop: spacing.lg
  },
  chartColumn: {
    alignItems: "center",
    flex: 1,
    gap: spacing.xs
  },
  barTrack: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: radius.pill,
    height: 92,
    justifyContent: "flex-end",
    overflow: "hidden",
    width: "100%"
  },
  bar: {
    backgroundColor: colors.gold,
    borderRadius: radius.pill,
    minHeight: 8,
    width: "100%"
  },
  chartLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "900"
  }
});
