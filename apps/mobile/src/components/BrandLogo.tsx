import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "../theme/tokens";

type BrandLogoProps = {
  compact?: boolean;
  centered?: boolean;
  size?: "sm" | "md" | "lg";
};

export const BrandLogo = ({ compact = false, centered = false, size = "md" }: BrandLogoProps) => (
  <View style={[styles.wrap, centered && styles.centered]}>
    <View style={[styles.mark, styles[`mark_${size}`]]}>
      <View style={styles.ballOuter}>
        <View style={styles.ballCore} />
        <View style={[styles.ballLine, styles.ballLineVertical]} />
        <View style={[styles.ballLine, styles.ballLineHorizontal]} />
      </View>
    </View>
    {!compact ? (
      <View style={styles.wordmark}>
        <Text style={[styles.logoLine, styles[`logoLine_${size}`]]}>GOL DE</Text>
        <Text style={[styles.logoLine, styles.logoLineStrong, styles[`logoLine_${size}`]]}>OURO</Text>
      </View>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm
  },
  centered: {
    alignSelf: "center"
  },
  mark: {
    alignItems: "center",
    backgroundColor: colors.gold,
    borderColor: "rgba(246, 211, 101, 0.42)",
    borderRadius: radius.sm,
    borderWidth: 1,
    justifyContent: "center",
    shadowColor: colors.goldDark,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.32,
    shadowRadius: 18
  },
  mark_sm: {
    height: 36,
    width: 36
  },
  mark_md: {
    height: 54,
    width: 54
  },
  mark_lg: {
    height: 78,
    width: 78
  },
  ballOuter: {
    alignItems: "center",
    borderColor: colors.black,
    borderRadius: radius.pill,
    borderWidth: 2,
    height: "58%",
    justifyContent: "center",
    overflow: "hidden",
    width: "58%"
  },
  ballCore: {
    backgroundColor: colors.black,
    borderRadius: radius.pill,
    height: "36%",
    opacity: 0.86,
    width: "36%"
  },
  ballLine: {
    backgroundColor: colors.black,
    opacity: 0.86,
    position: "absolute"
  },
  ballLineVertical: {
    height: "100%",
    width: 2
  },
  ballLineHorizontal: {
    height: 2,
    width: "100%"
  },
  wordmark: {
    gap: 0
  },
  logoLine: {
    color: colors.goldHighlight,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 25
  },
  logoLine_sm: {
    fontSize: 18,
    lineHeight: 19
  },
  logoLine_md: {
    fontSize: 26,
    lineHeight: 27
  },
  logoLine_lg: {
    fontSize: 42,
    lineHeight: 42
  },
  logoLineStrong: {
    color: colors.gold
  }
});
