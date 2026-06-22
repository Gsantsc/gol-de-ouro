import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Clock, Lock, MapPin, RadioTower, Trophy } from "lucide-react-native";
import type { Match, Prediction } from "../shared";
import {
  calculateMatchStatus,
  canSubmitPrediction,
  formatDateTimePtBr,
  getTeamDisplayName,
  MATCH_STATUS_LABELS
} from "../shared";
import { TeamFlag } from "./TeamFlag";
import { colors, radius, spacing } from "../theme/tokens";
import { Pill } from "./ui";

const statusTone = {
  aberto: "gold",
  fechado: "default",
  ao_vivo: "red",
  encerrado: "gold"
} as const;

const stadiumCities: Record<string, string> = {
  "at&t stadium": "Arlington",
  "bmo field": "Toronto",
  "bc place": "Vancouver",
  "estadio akron": "Guadalajara",
  "estadio azteca": "Mexico City",
  "estadio bbva": "Monterrey",
  "gillette stadium": "Foxborough",
  "hard rock stadium": "Miami",
  "levi's stadium": "Santa Clara",
  "lincoln financial field": "Philadelphia",
  "lumen field": "Seattle",
  "mercedes-benz stadium": "Atlanta",
  "metlife stadium": "East Rutherford",
  "nrg stadium": "Houston",
  "sofi stadium": "Los Angeles"
};

const normalizeName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const cityForStadium = (stadium?: string | null) =>
  stadium ? stadiumCities[normalizeName(stadium)] ?? null : null;

const MatchCardBase = ({
  match,
  prediction,
  onDetails,
  onPredict,
  onOpenPredictions,
  predictionLockMinutes,
  predictionActionMode = "enabled"
}: {
  match: Match;
  prediction?: Prediction;
  onDetails: () => void;
  onPredict: () => void;
  onOpenPredictions?: () => void;
  predictionLockMinutes: number;
  predictionActionMode?: "enabled" | "redirect" | "hidden";
}) => {
  const calculatedStatus = calculateMatchStatus(match, new Date(), predictionLockMinutes);
  const predictionAccess = canSubmitPrediction(match, null, new Date(), predictionLockMinutes);
  const canEditOrPredict = predictionAccess.allowed;
  const city = cityForStadium(match.stadium);
  const statusLabel = MATCH_STATUS_LABELS[calculatedStatus];
  const venue = [city ?? match.stadium, match.round].filter(Boolean).join(" - ");
  const actionLabel = prediction ? "Editar" : canEditOrPredict ? "Aberto" : "Fechado";

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onDetails}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.topline}>
        <Pill tone={statusTone[calculatedStatus]}>{statusLabel}</Pill>
        <View style={styles.timeWrap}>
          <Clock color={colors.muted} size={14} />
          <Text style={styles.time}>{formatDateTimePtBr(match.start_time)}</Text>
        </View>
      </View>

      <View style={styles.mainRow}>
        <View style={styles.teams}>
          <TeamLine
            logoUrl={match.home_team_logo_url}
            name={match.home_team}
            score={match.home_score}
          />
          <TeamLine
            logoUrl={match.away_team_logo_url}
            name={match.away_team}
            score={match.away_score}
          />
        </View>
        <View style={[styles.actionRail, canEditOrPredict && styles.actionRailOpen, prediction && styles.actionRailLocked]}>
          <Text style={styles.railLabel}>{actionLabel}</Text>
          {predictionActionMode === "hidden" ? null : predictionActionMode === "redirect" ? (
            <>
              {prediction ? (
                <>
                  <Text style={styles.predictionScore}>Enviado</Text>
                  <Text style={styles.railHint}>detalhes em Palpites</Text>
                </>
              ) : canEditOrPredict ? (
                <Text style={styles.railHint}>disponível</Text>
              ) : (
                <Text style={styles.closedLabel}>offline</Text>
              )}
              {onOpenPredictions && (
                <Pressable accessibilityRole="button" onPress={onOpenPredictions} style={styles.predictCta}>
                  <Text style={styles.predictCtaText}>Ir para Palpites</Text>
                </Pressable>
              )}
            </>
          ) : (
            <>
              {prediction ? (
                <>
                  <Text style={styles.predictionScore}>Enviado</Text>
                  <Text style={styles.railHint}>detalhes em Palpites</Text>
                  {canEditOrPredict ? (
                    <Pressable accessibilityRole="button" onPress={onPredict} style={styles.predictCta}>
                      <Text style={styles.predictCtaText}>Editar</Text>
                    </Pressable>
                  ) : (
                    <Text style={styles.railHint}>fechado</Text>
                  )}
                </>
              ) : canEditOrPredict ? (
                <Pressable accessibilityRole="button" onPress={onPredict} style={styles.predictCta}>
                  <Text style={styles.predictCtaText}>Palpitar</Text>
                </Pressable>
              ) : (
                <Text style={styles.closedLabel}>offline</Text>
              )}
            </>
          )}
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.metaRow}>
          <MapPin color={colors.muted} size={13} />
          <Text numberOfLines={1} style={styles.metaText}>{venue || "Local a definir"}</Text>
        </View>
        <View style={styles.stateRow}>
          {prediction ? (
            <Lock color={colors.gold} size={14} />
          ) : canEditOrPredict ? (
            <RadioTower color={colors.gold} size={14} />
          ) : (
            <Trophy color={colors.muted} size={14} />
          )}
          <Text numberOfLines={1} style={styles.stateText}>
            {prediction
              ? canEditOrPredict ? "Enviado, ainda editável" : "Enviado e fechado"
              : canEditOrPredict
                ? "Janela aberta"
                : predictionAccess.state === "not_open"
                  ? "Abre 24h antes"
                  : "Palpites fechados"}
          </Text>
        </View>
      </View>
    </Pressable>
  );
};

const TeamLine = ({
  name,
  logoUrl,
  score
}: {
  name: string;
  logoUrl?: string | null;
  score: number;
}) => {
  const displayName = getTeamDisplayName(name);

  return (
    <View style={styles.teamLine}>
      <TeamFlag logoUrl={logoUrl} name={name} size={26} />
      <Text numberOfLines={1} style={styles.teamName}>{displayName}</Text>
      <View style={styles.scoreBadge}>
        <Text style={styles.scoreText}>{score}</Text>
      </View>
    </View>
  );
};

export const MatchCard = memo(MatchCardBase);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceGlass,
    borderColor: colors.borderGold,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.sm,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 16
  },
  cardPressed: {
    opacity: 0.86,
    transform: [{ translateY: 1 }]
  },
  topline: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
    justifyContent: "space-between"
  },
  timeWrap: {
    alignItems: "center",
    flexDirection: "row",
    flexShrink: 1,
    gap: spacing.xs
  },
  time: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800"
  },
  mainRow: {
    alignItems: "stretch",
    flexDirection: "row",
    gap: spacing.sm
  },
  teams: {
    flex: 1,
    gap: spacing.xs
  },
  teamLine: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
    minHeight: 31
  },
  badge: {
    alignItems: "center",
    backgroundColor: colors.surfaceDeep,
    borderColor: colors.border,
    borderRadius: radius.xs,
    borderWidth: 1,
    height: 26,
    justifyContent: "center",
    overflow: "hidden",
    width: 26
  },
  badgeText: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: "900"
  },
  logo: {
    height: 19,
    width: 24
  },
  teamName: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    fontWeight: "900"
  },
  scoreBadge: {
    alignItems: "center",
    backgroundColor: colors.surfaceDeep,
    borderColor: colors.border,
    borderRadius: radius.xs,
    borderWidth: 1,
    height: 28,
    justifyContent: "center",
    minWidth: 30
  },
  scoreText: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900",
    textAlign: "right"
  },
  actionRail: {
    alignItems: "center",
    backgroundColor: colors.surfaceDeep,
    borderColor: colors.borderGold,
    borderRadius: radius.sm,
    borderWidth: 1,
    justifyContent: "center",
    minWidth: 76,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs
  },
  actionRailOpen: {
    backgroundColor: colors.goldSoft,
    borderColor: colors.borderGoldStrong
  },
  actionRailLocked: {
    backgroundColor: colors.surfaceDeep
  },
  railLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "900",
    marginBottom: 2,
    textTransform: "uppercase"
  },
  predictionScore: {
    color: colors.gold,
    fontSize: 21,
    fontWeight: "900"
  },
  railHint: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: "900",
    marginTop: 1,
    textTransform: "uppercase"
  },
  predictCta: {
    alignItems: "center",
    backgroundColor: colors.gold,
    borderRadius: radius.xs,
    justifyContent: "center",
    minHeight: 30,
    paddingHorizontal: spacing.xs
  },
  predictCtaText: {
    color: colors.black,
    fontSize: 11,
    fontWeight: "900"
  },
  closedLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  footer: {
    alignItems: "center",
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
    paddingTop: spacing.xs
  },
  metaRow: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 5
  },
  metaText: {
    color: colors.muted,
    flex: 1,
    fontSize: 11,
    fontWeight: "700"
  },
  stateRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
    maxWidth: 132
  },
  stateText: {
    color: colors.mutedStrong,
    fontSize: 11,
    fontWeight: "800"
  }
});
