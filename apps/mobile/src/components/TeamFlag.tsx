import { useEffect, useMemo, useState } from "react";
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { getFlagUrlCandidates, getTeamInitials } from "../shared/team-flags";
import { colors, radius } from "../theme/tokens";

export const TeamFlag = ({
  name,
  logoUrl,
  size = 26,
  style
}: {
  name: string;
  logoUrl?: string | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) => {
  const candidates = useMemo(() => getFlagUrlCandidates(name, logoUrl), [logoUrl, name]);
  const [candidateIndex, setCandidateIndex] = useState(0);

  useEffect(() => {
    setCandidateIndex(0);
  }, [name, logoUrl]);

  const currentUrl = candidates[candidateIndex] ?? null;

  return (
    <View style={[styles.badge, { height: size, width: size }, style]}>
      {currentUrl ? (
        <Image
          accessibilityLabel=""
          onError={() => setCandidateIndex((index) => index + 1)}
          source={{ uri: currentUrl }}
          style={[styles.logo, { height: Math.round(size * 0.73), width: Math.round(size * 0.92) }]}
        />
      ) : (
        <Text style={[styles.initials, { fontSize: Math.max(9, Math.round(size * 0.42)) }]}>
          {getTeamInitials(name)}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    alignItems: "center",
    backgroundColor: colors.surfaceDeep,
    borderColor: colors.border,
    borderRadius: radius.xs,
    borderWidth: 1,
    justifyContent: "center",
    overflow: "hidden"
  },
  initials: {
    color: colors.gold,
    fontWeight: "900"
  },
  logo: {
    resizeMode: "cover"
  }
});
