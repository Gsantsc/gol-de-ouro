import { ActivityIndicator, Animated, Easing, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef } from "react";
import { BrandLogo } from "../components/BrandLogo";
import { colors, spacing } from "../theme/tokens";

export const SplashScreen = () => {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          duration: 900,
          easing: Easing.out(Easing.quad),
          toValue: 1,
          useNativeDriver: true
        }),
        Animated.timing(pulse, {
          duration: 900,
          easing: Easing.in(Easing.quad),
          toValue: 0,
          useNativeDriver: true
        })
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });

  return (
    <LinearGradient colors={[colors.background, colors.surface, colors.background]} style={styles.root}>
      <View pointerEvents="none" style={styles.light} />
      <Animated.View style={[styles.logo, { transform: [{ scale }] }]}>
        <BrandLogo centered size="lg" />
      </Animated.View>
      <Text style={styles.subtitle}>Bolão premium de futebol</Text>
      <ActivityIndicator color={colors.gold} style={styles.loader} />
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  root: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg
  },
  light: {
    backgroundColor: "rgba(246, 211, 101, 0.11)",
    borderRadius: 260,
    height: 300,
    left: -110,
    position: "absolute",
    top: -120,
    width: 300
  },
  logo: {
    alignItems: "center"
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: "800",
    marginTop: spacing.md
  },
  loader: {
    marginTop: spacing.xl
  }
});
