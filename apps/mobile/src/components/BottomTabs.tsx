import { useEffect, useRef } from "react";
import type { ComponentType } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { CalendarDays, Home, ListChecks, Trophy, UserRound, Users } from "lucide-react-native";
import { colors, radius, spacing } from "../theme/tokens";

export type MainTab = "home" | "games" | "predictions" | "ranking" | "profile" | "groups";

const tabs = [
  { id: "home", label: "Home", icon: Home },
  { id: "games", label: "Jogos", icon: CalendarDays },
  { id: "predictions", label: "Palpites", icon: ListChecks },
  { id: "ranking", label: "Ranking", icon: Trophy },
  { id: "groups", label: "Ligas", icon: Users },
  { id: "profile", label: "Perfil", icon: UserRound }
] as const;

export const BottomTabs = ({
  activeTab,
  onChange
}: {
  activeTab: MainTab;
  onChange: (tab: MainTab) => void;
}) => (
  <View style={styles.tabs}>
    {tabs.map((tab) => (
      <TabButton
        active={activeTab === tab.id}
        icon={tab.icon}
        key={tab.id}
        label={tab.label}
        onPress={() => onChange(tab.id)}
      />
    ))}
  </View>
);

const TabButton = ({
  active,
  icon: Icon,
  label,
  onPress
}: {
  active: boolean;
  icon: ComponentType<{ color?: string; size?: number }>;
  label: string;
  onPress: () => void;
}) => {
  const scale = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(scale, {
      damping: 15,
      mass: 0.8,
      stiffness: 180,
      toValue: active ? 1 : 0,
      useNativeDriver: true
    }).start();
  }, [active, scale]);

  const translateY = scale.interpolate({ inputRange: [0, 1], outputRange: [0, -2] });
  const activeScale = scale.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
    >
      <Animated.View
        style={[
          styles.tabInner,
          active && styles.tabInnerActive,
          { transform: [{ translateY }, { scale: activeScale }] }
        ]}
      >
        <Icon color={active ? colors.black : colors.muted} size={19} />
        <Text numberOfLines={1} style={[styles.label, active && styles.labelActive]}>{label}</Text>
      </Animated.View>
      {active ? <View style={styles.activeDot} /> : null}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  tabs: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.borderGold,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.xs,
    padding: spacing.xs,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.24,
    shadowRadius: 20
  },
  tab: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    minHeight: 58
  },
  tabPressed: {
    opacity: 0.78
  },
  tabInner: {
    alignItems: "center",
    borderRadius: radius.sm,
    gap: 3,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 4,
    width: "100%"
  },
  tabInnerActive: {
    backgroundColor: colors.gold,
    shadowColor: colors.goldDark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 12
  },
  activeDot: {
    backgroundColor: colors.goldHighlight,
    borderRadius: radius.pill,
    bottom: 3,
    height: 3,
    position: "absolute",
    width: 18
  },
  label: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "900"
  },
  labelActive: {
    color: colors.black
  }
});
