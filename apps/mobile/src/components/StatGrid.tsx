import { StyleSheet, Text, View } from "react-native";
import type { MatchStatistics } from "../shared";
import { colors, radius, spacing } from "../theme/tokens";

const rows = [
  ["Posse de bola", "possession_home", "possession_away", "%"],
  ["Finalizações", "shots_home", "shots_away", ""],
  ["No gol", "shots_on_goal_home", "shots_on_goal_away", ""],
  ["Escanteios", "corners_home", "corners_away", ""],
  ["Faltas", "fouls_home", "fouls_away", ""],
  ["Amarelos", "yellow_cards_home", "yellow_cards_away", ""],
  ["Vermelhos", "red_cards_home", "red_cards_away", ""],
  ["xG", "xg_home", "xg_away", ""]
] as const;

export const StatGrid = ({ stats }: { stats: MatchStatistics | null }) => {
  if (!stats) {
    return <Text style={styles.muted}>Estatísticas ainda não cadastradas.</Text>;
  }

  return (
    <View style={styles.grid}>
      {rows.map(([label, homeKey, awayKey, suffix]) => (
        <View key={label} style={styles.row}>
          <Text style={styles.value}>{stats[homeKey]}{suffix}</Text>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.value}>{stats[awayKey]}{suffix}</Text>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  grid: {
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    overflow: "hidden"
  },
  row: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  label: {
    color: colors.muted,
    flex: 1.4,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center"
  },
  value: {
    color: colors.text,
    flex: 0.6,
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center"
  },
  muted: {
    color: colors.muted,
    lineHeight: 21
  }
});
