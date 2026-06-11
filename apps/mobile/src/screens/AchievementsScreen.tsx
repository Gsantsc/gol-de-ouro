import { StyleSheet, Text, View } from "react-native";
import { Award, CheckCircle2, Lock } from "lucide-react-native";
import type { Achievement } from "../shared";
import { Card, SectionTitle } from "../components/ui";
import { colors, radius, spacing } from "../theme/tokens";

export const AchievementsScreen = ({ achievements }: { achievements: Achievement[] }) => (
  <>
    <SectionTitle title="Conquistas" />
    {achievements.length ? (
      achievements.map((achievement) => {
        const unlocked = Boolean(achievement.unlocked_at);
        const percent = Math.min(100, Math.round((achievement.progress / achievement.goal) * 100));
        return (
          <Card key={achievement.id}>
            <View style={styles.row}>
              <View style={[styles.icon, unlocked && styles.iconUnlocked]}>
                {unlocked ? <CheckCircle2 color={colors.black} size={24} /> : <Lock color={colors.muted} size={24} />}
              </View>
              <View style={styles.content}>
                <Text style={styles.badge}>{achievement.badge}</Text>
                <Text style={styles.description}>{achievement.description}</Text>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${percent}%` }]} />
                </View>
                <Text style={styles.progress}>{achievement.progress}/{achievement.goal}</Text>
              </View>
            </View>
          </Card>
        );
      })
    ) : (
      <Card>
        <Award color={colors.gold} size={28} />
        <Text style={styles.emptyTitle}>Conquistas prontas para desbloquear</Text>
        <Text style={styles.description}>Envie palpites e entre em ligas para iniciar sua coleção.</Text>
      </Card>
    )}
  </>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.md
  },
  icon: {
    alignItems: "center",
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    height: 52,
    justifyContent: "center",
    width: 52
  },
  iconUnlocked: {
    backgroundColor: colors.gold,
    borderColor: colors.gold
  },
  content: {
    flex: 1
  },
  badge: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900"
  },
  description: {
    color: colors.muted,
    lineHeight: 20,
    marginTop: 4
  },
  progressTrack: {
    backgroundColor: colors.background,
    borderRadius: radius.pill,
    height: 8,
    marginTop: spacing.sm,
    overflow: "hidden"
  },
  progressFill: {
    backgroundColor: colors.gold,
    height: 8
  },
  progress: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: "900",
    marginTop: 4
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
    marginTop: spacing.md
  }
});
