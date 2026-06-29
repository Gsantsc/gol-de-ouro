import React, { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Clock, Lock, MapPin, RadioTower, Trophy } from "lucide-react-native";
import type { Match, Prediction } from "../shared";
import {
  calculateMatchStatus,
  canCreatePrediction,
  formatDateTimePtBr,
  formatTeamDisplayName,
  getSeedLabel,
  hasUndefinedParticipant,
  isKnockoutPlaceholder,
  MATCH_STATUS_LABELS
} from "../shared";
import { TeamFlag } from "./TeamFlag";
import { colors, radius, spacing } from "../theme/tokens";
import { Pill, StatusBadge } from "./ui";

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

const scoreLabel = (value?: number | null) => (typeof value === "number" ? String(value) : "-");

const predictionScoreLabel = (prediction?: Prediction) => {
  if (!prediction) return null;
  return `${prediction.predicted_home_score} x ${prediction.predicted_away_score}`;
};

const TeamColumn = ({
  align = "left",
  name,
  logoUrl
}: {
  align?: "left" | "right";
  name: string;
  logoUrl?: string | null;
}) => {
  const displayName = formatTeamDisplayName(name);
  const seedLabel = getSeedLabel(name);
  const unresolved = isKnockoutPlaceholder(name);

  return (
    <View style={[styles.teamColumn, align === "right" && styles.teamColumnRight]}>
      <TeamFlag logoUrl={unresolved ? null : logoUrl} name={displayName} size={34} />
      <Text
        numberOfLines={2}
        style={[styles.teamColumnName, align === "right" && styles.teamColumnNameRight]}
      >
        {displayName}
      </Text>
      {seedLabel ? (
        <Text numberOfLines={1} style={[styles.seedLabel, align === "right" && styles.seedLabelRight]}>
          {seedLabel}
        </Text>
      ) : null}
    </View>
  );
};

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
  const predictionAccess = canCreatePrediction(match, null, new Date(), predictionLockMinutes);
  const hasUndefinedTeams = hasUndefinedParticipant(match);
  const canEditOrPredict = predictionAccess.allowed;
  const city = cityForStadium(match.stadium);
  const statusLabel = MATCH_STATUS_LABELS[calculatedStatus];
  const venue = [city ?? match.stadium, match.round].filter(Boolean).join(" - ");
  const shouldShowScore = calculatedStatus === "ao_vivo" || calculatedStatus === "encerrado";
  const homeScoreLabel = shouldShowScore ? scoreLabel(match.live_score?.home ?? match.home_score) : "-";
  const awayScoreLabel = shouldShowScore ? scoreLabel(match.live_score?.away ?? match.away_score) : "-";
  const userPrediction = predictionScoreLabel(prediction);
  const showRedirectCta = canEditOrPredict || Boolean(onOpenPredictions);
  const primaryActionLabel = prediction
    ? canEditOrPredict ? "Editar palpite" : "Ver palpite"
    : canEditOrPredict ? "Palpitar" : hasUndefinedTeams ? "Aguardando times" : "Ver palpites";
  const stateText = prediction
    ? canEditOrPredict ? "Enviado, ainda editavel" : "Enviado e fechado"
    : hasUndefinedTeams
      ? "Times ainda nao definidos"
      : canEditOrPredict
      ? "Janela aberta"
      : predictionAccess.state === "not_open"
        ? "Abre 24h antes"
        : "Palpites fechados";

  const handleRedirectPredictionPress = () => {
    if (canEditOrPredict) {
      onPredict();
      return;
    }

    onOpenPredictions?.();
  };

  const handlePredictionPress = () => {
    if (predictionActionMode === "redirect") {
      handleRedirectPredictionPress();
      return;
    }

    if (canEditOrPredict) onPredict();
  };

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onDetails}
      style={({ pressed }) => [styles.card, calculatedStatus === "ao_vivo" && styles.cardLive, pressed && styles.cardPressed]}
    >
      <View style={styles.topline}>
        <StatusBadge label={statusLabel} status={calculatedStatus} />
        <View style={styles.timeWrap}>
          <Clock color={colors.muted} size={14} />
          <Text style={styles.time}>{formatDateTimePtBr(match.start_time)}</Text>
        </View>
      </View>

      <View style={styles.scoreboard}>
        <TeamColumn
          logoUrl={match.home_team_logo_url}
          name={match.home_team}
        />

        <View style={styles.scoreCenter}>
          <Text style={styles.scoreText}>{homeScoreLabel}</Text>
          <Text style={styles.versusText}>x</Text>
          <Text style={styles.scoreText}>{awayScoreLabel}</Text>
        </View>

        <TeamColumn
          align="right"
          logoUrl={match.away_team_logo_url}
          name={match.away_team}
        />
      </View>

      <View style={styles.predictionPanel}>
        <View style={styles.predictionInfo}>
          {prediction ? (
            <Pill tone="green">Palpite enviado</Pill>
          ) : (
            <Pill tone={canEditOrPredict ? "gold" : "default"}>{canEditOrPredict ? "Aberto" : "Bloqueado"}</Pill>
          )}
          <Text style={styles.predictionHint}>
            {userPrediction ? `Seu palpite: ${userPrediction}` : stateText}
          </Text>
        </View>

        {predictionActionMode === "hidden" ? null : showRedirectCta || predictionActionMode === "enabled" ? (
          <Pressable
            accessibilityRole="button"
            disabled={hasUndefinedTeams || (!canEditOrPredict && !onOpenPredictions)}
            onPress={handlePredictionPress}
            style={({ pressed }) => [
              styles.predictCta,
              (!canEditOrPredict || hasUndefinedTeams) && styles.predictCtaMuted,
              pressed && styles.predictCtaPressed
            ]}
          >
            <Text style={[styles.predictCtaText, (!canEditOrPredict || hasUndefinedTeams) && styles.predictCtaTextMuted]}>
              {primaryActionLabel}
            </Text>
          </Pressable>
        ) : null}
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
          <Text numberOfLines={1} style={styles.stateText}>{stateText}</Text>
        </View>
      </View>
    </Pressable>
  );
};

export const MatchCard = memo(MatchCardBase);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceGlass,
    borderColor: colors.borderGold,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.26,
    shadowRadius: 22
  },
  cardLive: {
    borderColor: colors.redBorder
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
    flexShrink: 1,
    fontSize: 11,
    fontWeight: "800",
    textAlign: "right"
  },
  scoreboard: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.035)",
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
    padding: spacing.sm
  },
  teamColumn: {
    alignItems: "flex-start",
    flex: 1,
    gap: 6,
    minWidth: 0
  },
  teamColumnRight: {
    alignItems: "flex-end"
  },
  teamColumnName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 17
  },
  teamColumnNameRight: {
    textAlign: "right"
  },
  seedLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "800",
    lineHeight: 13
  },
  seedLabelRight: {
    textAlign: "right"
  },
  scoreCenter: {
    alignItems: "center",
    backgroundColor: colors.surfaceDeep,
    borderColor: colors.borderGoldStrong,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "center",
    minWidth: 96,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  scoreText: {
    color: colors.gold,
    fontSize: 26,
    fontWeight: "900",
    lineHeight: 30
  },
  versusText: {
    color: colors.muted,
    fontSize: 16,
    fontWeight: "900",
    marginHorizontal: spacing.xs
  },
  predictionPanel: {
    alignItems: "center",
    backgroundColor: colors.surfaceDeep,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "space-between",
    padding: spacing.sm
  },
  predictionInfo: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 160
  },
  predictionHint: {
    color: colors.mutedStrong,
    fontSize: 12,
    fontWeight: "800"
  },
  predictCta: {
    alignItems: "center",
    backgroundColor: colors.gold,
    borderRadius: radius.md,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: spacing.md
  },
  predictCtaMuted: {
    backgroundColor: colors.whiteSoft,
    borderColor: colors.border,
    borderWidth: 1
  },
  predictCtaPressed: {
    opacity: 0.82,
    transform: [{ translateY: 1 }]
  },
  predictCtaText: {
    color: colors.black,
    fontSize: 12,
    fontWeight: "900"
  },
  predictCtaTextMuted: {
    color: colors.text
  },
  footer: {
    alignItems: "center",
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "space-between",
    paddingTop: spacing.xs
  },
  metaRow: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 5,
    minWidth: 160
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
    maxWidth: 180
  },
  stateText: {
    color: colors.mutedStrong,
    fontSize: 11,
    fontWeight: "800"
  }
});
