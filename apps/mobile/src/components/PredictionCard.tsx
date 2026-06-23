import { StyleSheet, Text, View, useWindowDimensions, type DimensionValue } from "react-native";
import type { Match, Player, Prediction, PredictionWinner } from "../shared";
import {
  getPredictionStatusLabel,
  getPredictionStatusTone,
  getTeamDisplayName,
  isPlayerEligibleForMatch,
  type PredictionDisplayStatus
} from "../shared";
import { Pill } from "./ui";
import { TeamFlag } from "./TeamFlag";
import { colors, radius, spacing } from "../theme/tokens";

const COMPACT_BREAKPOINT = 560;

const safeNumberLabel = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? String(parsed) : "-";
};

const getOfficialScoreLabel = (match?: Match | null) => {
  if (!match) return "- x -";
  const home = match.live_score?.home ?? match.home_score;
  const away = match.live_score?.away ?? match.away_score;
  return `${safeNumberLabel(home)} x ${safeNumberLabel(away)}`;
};

const getUserPredictionScoreLabel = (prediction: Prediction) => {
  return `${safeNumberLabel(prediction.predicted_home_score)} x ${safeNumberLabel(prediction.predicted_away_score)}`;
};

const getPointsLabel = (prediction: Prediction, match?: Match | null) => {
  if (!match) return `${Number(prediction.points ?? 0)} pts`;
  if (match.status === "ao_vivo") return "Aguardando final";
  if (match.status !== "encerrado") return "Aguardando";
  return `${Number(prediction.points ?? 0)} pts`;
};

const winnerLabel = (winner: PredictionWinner | null | undefined, match: Match | null) => {
  if (winner === "home") return getTeamDisplayName(match?.home_team) || "Casa";
  if (winner === "away") return getTeamDisplayName(match?.away_team) || "Visitante";
  if (winner === "draw") return "Empate";
  return "-";
};

const boolLabel = (value?: boolean | null) => {
  if (value === true) return "Sim";
  if (value === false) return "Nao";
  return "-";
};

const marketText = (value?: string | null) => value?.trim() || "-";

const resolvePredictionPlayerLabel = ({
  playerId,
  fallbackName,
  match,
  playerById
}: {
  playerId?: string | null;
  fallbackName?: string | null;
  match: Match | null;
  playerById: Map<string, Player>;
}): string => {
  const player = playerById.get(playerId ?? "");

  if (player && match && isPlayerEligibleForMatch(player, match)) {
    return player.name;
  }

  if (player && match && !isPlayerEligibleForMatch(player, match)) {
    return "Jogador inválido para esta partida";
  }

  return fallbackName?.trim() || "-";
};

const PredictionDetail = ({ basis, label, value }: { basis: DimensionValue; label: string; value: string }) => (
  <View style={[styles.detailItem, { flexBasis: basis }]}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text numberOfLines={2} style={styles.detailValue}>{value}</Text>
  </View>
);

const TeamSide = ({
  align,
  compact,
  logoUrl,
  name
}: {
  align: "home" | "away";
  compact: boolean;
  logoUrl?: string | null;
  name: string;
}) => {
  const flagSize = compact ? 20 : 24;
  const displayName = getTeamDisplayName(name);

  return (
    <View style={[styles.teamSide, align === "home" ? styles.teamSideHome : styles.teamSideAway, compact && styles.teamSideCompact]}>
      {align === "home" ? (
        <>
          <TeamFlag logoUrl={logoUrl} name={name} size={flagSize} />
          <Text numberOfLines={2} style={[styles.teamName, styles.teamNameHome]}>{displayName}</Text>
        </>
      ) : (
        <>
          <Text numberOfLines={2} style={[styles.teamName, styles.teamNameAway]}>{displayName}</Text>
          <TeamFlag logoUrl={logoUrl} name={name} size={flagSize} />
        </>
      )}
    </View>
  );
};

export const PredictionCard = ({
  displayStatus,
  formattedDate,
  match,
  playerById,
  prediction
}: {
  displayStatus: PredictionDisplayStatus;
  formattedDate: string;
  match: Match | null;
  playerById: Map<string, Player>;
  prediction: Prediction;
}) => {
  const { width } = useWindowDimensions();
  const compact = width < COMPACT_BREAKPOINT;
  const detailBasis: DimensionValue = width >= 1024 ? "18%" : width >= 768 ? "30%" : "48%";
  const statusLabel = getPredictionStatusLabel(displayStatus);
  const statusTone = getPredictionStatusTone(displayStatus);
  const officialScore = getOfficialScoreLabel(match);
  const userPredictionScore = getUserPredictionScoreLabel(prediction);
  const pointsLabel = getPointsLabel(prediction, match);

  return (
    <View style={styles.predictionCard}>
      <View style={styles.predictionHeader}>
        <Pill tone={statusTone}>{statusLabel}</Pill>
        <Text style={styles.predictionDate}>{formattedDate}</Text>
      </View>

      {match ? (
        <View style={[styles.matchupRow, compact && styles.matchupRowCompact]}>
          <TeamSide
            align="home"
            compact={compact}
            logoUrl={match.home_team_logo_url}
            name={match.home_team}
          />
          {!compact ? (
            <View style={styles.scoreCenter}>
              <Text style={styles.scoreText}>{officialScore}</Text>
            </View>
          ) : null}
          <TeamSide
            align="away"
            compact={compact}
            logoUrl={match.away_team_logo_url}
            name={match.away_team}
          />
        </View>
      ) : (
        <View style={styles.unavailableMatch}>
          <Text style={styles.unavailableTitle}>Partida indisponivel</Text>
          <Text style={styles.unavailableHint}>Palpite registrado</Text>
        </View>
      )}

      {compact ? (
        <View style={styles.scoreCenterCompact}>
          <Text style={styles.scoreText}>{officialScore}</Text>
        </View>
      ) : null}

      <View style={styles.predictionSummary}>
        <Text style={styles.predictionSummaryLabel}>
          Seu palpite: {userPredictionScore}
        </Text>
        <Text style={[styles.pointsText, prediction.points && prediction.points > 0 ? styles.pointsPositive : styles.pointsNeutral]}>
          {pointsLabel}
        </Text>
      </View>

      <View style={[styles.detailsGrid, compact ? styles.detailsGridCompact : styles.detailsGridWide]}>
        <PredictionDetail basis={detailBasis} label="Vencedor" value={winnerLabel(prediction.predicted_winner, match)} />
        <PredictionDetail
          basis={detailBasis}
          label="Primeiro gol"
          value={
            prediction.predicted_first_goal_no_goals
              ? "Sem gols"
              : resolvePredictionPlayerLabel({
                  playerId: prediction.predicted_first_scorer_id,
                  fallbackName: prediction.predicted_first_scorer,
                  match,
                  playerById
                })
          }
        />
        <PredictionDetail basis={detailBasis} label="Ambos" value={boolLabel(prediction.predicted_both_teams_score)} />
        <PredictionDetail
          basis={detailBasis}
          label="MVP"
          value={
            resolvePredictionPlayerLabel({
              playerId: prediction.predicted_man_of_match_id,
              fallbackName: prediction.predicted_man_of_match,
              match,
              playerById
            })
          }
        />
        <PredictionDetail basis={detailBasis} label="Vermelho" value={boolLabel(prediction.predicted_red_card)} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  predictionCard: {
    backgroundColor: "rgba(11, 15, 25, 0.42)",
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.sm
  },
  predictionHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between"
  },
  predictionDate: {
    color: colors.muted,
    flexShrink: 1,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "right"
  },
  matchupRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
    minHeight: 52
  },
  matchupRowCompact: {
    flexDirection: "column",
    gap: spacing.xs,
    minHeight: 0
  },
  teamSide: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: spacing.xs,
    minWidth: 0
  },
  teamSideCompact: {
    alignSelf: "stretch",
    flex: 0,
    width: "100%"
  },
  teamSideHome: {
    justifyContent: "flex-start"
  },
  teamSideAway: {
    justifyContent: "flex-end"
  },
  teamName: {
    color: colors.text,
    flexShrink: 1,
    fontSize: 15,
    fontWeight: "900",
    minWidth: 0
  },
  teamNameHome: {
    textAlign: "left"
  },
  teamNameAway: {
    textAlign: "right"
  },
  scoreCenter: {
    alignItems: "center",
    backgroundColor: colors.goldWash,
    borderColor: colors.borderGold,
    borderRadius: radius.sm,
    borderWidth: 1,
    justifyContent: "center",
    minWidth: 96,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  scoreCenterCompact: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: colors.goldWash,
    borderColor: colors.borderGold,
    borderRadius: radius.sm,
    borderWidth: 1,
    minWidth: 112,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs
  },
  scoreText: {
    color: colors.gold,
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 0.5
  },
  unavailableMatch: {
    alignItems: "center",
    backgroundColor: colors.redSoft,
    borderColor: colors.redBorder,
    borderRadius: radius.sm,
    borderWidth: 1,
    gap: 2,
    padding: spacing.sm
  },
  unavailableTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900"
  },
  unavailableHint: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700"
  },
  predictionSummary: {
    alignItems: "center",
    borderColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
    paddingTop: spacing.xs
  },
  predictionSummaryLabel: {
    color: colors.mutedStrong,
    flex: 1,
    fontSize: 13,
    fontWeight: "800"
  },
  pointsText: {
    fontSize: 15,
    fontWeight: "900"
  },
  pointsPositive: {
    color: colors.green
  },
  pointsNeutral: {
    color: colors.muted
  },
  detailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs
  },
  detailsGridCompact: {
    justifyContent: "space-between"
  },
  detailsGridWide: {
    justifyContent: "flex-start"
  },
  detailItem: {
    backgroundColor: colors.surfaceDeep,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexGrow: 1,
    maxWidth: "100%",
    minWidth: 108,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs
  },
  detailLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  detailValue: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 4
  }
});
