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

type DetailPointState = "missing" | "neutral" | "pending" | "positive";

type DetailPoints = {
  label: string;
  state: DetailPointState;
};

type PredictionPointsBreakdown = {
  bothTeamsScore: DetailPoints;
  firstScorer: DetailPoints;
  manOfMatch: DetailPoints;
  redCard: DetailPoints;
  score: DetailPoints;
};

const normalizeMarketText = (value?: string | null) => {
  const normalized = value?.trim().toLowerCase();
  return normalized || null;
};

const scoreNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const outcomeForScore = (homeScore: number, awayScore: number): PredictionWinner => {
  if (homeScore > awayScore) return "home";
  if (awayScore > homeScore) return "away";
  return "draw";
};

const pointsBadgeFor = (points: number): DetailPoints => ({
  label: points > 0 ? `+${points} pts` : "0 pts",
  state: points > 0 ? "positive" : "neutral"
});

const pendingPoints = (match: Match | null): DetailPoints => ({
  label: match ? "Aguardando" : "-",
  state: "pending"
});

const missingOfficialPoints = (): DetailPoints => ({
  label: "Sem dado oficial",
  state: "missing"
});

const officialRedCardFor = (match: Match) => {
  const redCardCount = scoreNumber(match.red_cards_home) + scoreNumber(match.red_cards_away);
  if (redCardCount > 0) return true;
  if (match.red_card_happened === true || match.red_card_happened === false) return match.red_card_happened;
  return undefined;
};

const calculatePredictionBreakdown = ({
  displayStatus,
  match,
  prediction
}: {
  displayStatus: PredictionDisplayStatus;
  match: Match | null;
  prediction: Prediction;
}): PredictionPointsBreakdown => {
  const isScored = displayStatus === "scored_win" || displayStatus === "scored_zero";
  const pending = pendingPoints(match);

  if (!match || !isScored) {
    return {
      bothTeamsScore: pending,
      firstScorer: pending,
      manOfMatch: pending,
      redCard: pending,
      score: pending
    };
  }

  const homeScore = scoreNumber(match.home_score);
  const awayScore = scoreNumber(match.away_score);
  const predictedHomeScore = scoreNumber(prediction.predicted_home_score);
  const predictedAwayScore = scoreNumber(prediction.predicted_away_score);
  const exactScore = homeScore === predictedHomeScore && awayScore === predictedAwayScore;
  const officialOutcome = outcomeForScore(homeScore, awayScore);
  const predictedOutcome = prediction.predicted_winner ?? outcomeForScore(predictedHomeScore, predictedAwayScore);
  const sameOutcome = officialOutcome === predictedOutcome;
  const sameGoalDifference = homeScore - awayScore === predictedHomeScore - predictedAwayScore;
  const scorePoints = exactScore ? 10 : (sameOutcome ? 5 : 0) + (sameGoalDifference ? 3 : 0);

  const isNoGoalMatch = homeScore === 0 && awayScore === 0;
  const officialFirstScorerName = normalizeMarketText(match.first_goal_scorer);
  const hasOfficialFirstScorer = Boolean(match.first_goal_scorer_id || officialFirstScorerName);
  const firstScorerPoints = (() => {
    if (isNoGoalMatch) return pointsBadgeFor(prediction.predicted_first_goal_no_goals === true ? 8 : 0);
    if (!hasOfficialFirstScorer) return missingOfficialPoints();

    const hitById = Boolean(
      match.first_goal_scorer_id
      && prediction.predicted_first_scorer_id
      && match.first_goal_scorer_id === prediction.predicted_first_scorer_id
    );
    const hitByName = Boolean(
      !match.first_goal_scorer_id
      && !prediction.predicted_first_scorer_id
      && officialFirstScorerName
      && officialFirstScorerName === normalizeMarketText(prediction.predicted_first_scorer)
    );

    return pointsBadgeFor(hitById || hitByName ? 8 : 0);
  })();

  const bothTeamsScore = homeScore > 0 && awayScore > 0;
  const bothTeamsScorePoints = pointsBadgeFor(
    prediction.predicted_both_teams_score !== null
    && prediction.predicted_both_teams_score !== undefined
    && prediction.predicted_both_teams_score === bothTeamsScore
      ? 2
      : 0
  );

  const officialManOfMatchName = normalizeMarketText(match.man_of_match);
  const hasOfficialManOfMatch = Boolean(match.man_of_match_id || officialManOfMatchName);
  const manOfMatchPoints = (() => {
    if (!hasOfficialManOfMatch) return missingOfficialPoints();

    const hitById = Boolean(
      match.man_of_match_id
      && prediction.predicted_man_of_match_id
      && match.man_of_match_id === prediction.predicted_man_of_match_id
    );
    const hitByName = Boolean(
      !match.man_of_match_id
      && !prediction.predicted_man_of_match_id
      && officialManOfMatchName
      && officialManOfMatchName === normalizeMarketText(prediction.predicted_man_of_match)
    );

    return pointsBadgeFor(hitById || hitByName ? 6 : 0);
  })();

  const officialRedCard = officialRedCardFor(match);
  const redCardPoints =
    officialRedCard === undefined
      ? missingOfficialPoints()
      : pointsBadgeFor(
          prediction.predicted_red_card !== null
          && prediction.predicted_red_card !== undefined
          && prediction.predicted_red_card === officialRedCard
            ? 2
            : 0
        );

  return {
    bothTeamsScore: bothTeamsScorePoints,
    firstScorer: firstScorerPoints,
    manOfMatch: manOfMatchPoints,
    redCard: redCardPoints,
    score: pointsBadgeFor(scorePoints)
  };
};

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

const PredictionDetail = ({
  basis,
  compact,
  label,
  points,
  value
}: {
  basis: DimensionValue;
  compact: boolean;
  label: string;
  points: DetailPoints;
  value: string;
}) => (
  <View style={[styles.detailItem, compact && styles.detailItemCompact, { flexBasis: basis }]}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text numberOfLines={compact ? 3 : 2} style={styles.detailValue}>
      {value}
    </Text>
    <View
      style={[
        styles.detailPointsBadge,
        points.state === "positive" && styles.detailPointsBadgePositive,
        points.state === "neutral" && styles.detailPointsBadgeNeutral,
        points.state === "pending" && styles.detailPointsBadgePending,
        points.state === "missing" && styles.detailPointsBadgeMissing
      ]}
    >
      <Text
        style={[
          styles.detailPointsText,
          points.state === "positive" && styles.detailPointsTextPositive,
          points.state === "neutral" && styles.detailPointsTextNeutral,
          points.state === "pending" && styles.detailPointsTextPending,
          points.state === "missing" && styles.detailPointsTextMissing
        ]}
      >
        {points.label}
      </Text>
    </View>
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

  if (compact) {
    return (
      <View style={[styles.teamSide, styles.teamSideCompact]}>
        <TeamFlag logoUrl={logoUrl} name={name} size={flagSize} />
        <Text numberOfLines={2} style={[styles.teamName, styles.teamNameHome]}>
          {displayName}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.teamSide, align === "home" ? styles.teamSideHome : styles.teamSideAway]}>
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
  const detailBasis: DimensionValue = compact
    ? "100%"
    : width >= 1024
      ? "18%"
      : width >= 768
        ? "30%"
        : "48%";
  const statusLabel = getPredictionStatusLabel(displayStatus);
  const statusTone = getPredictionStatusTone(displayStatus);
  const officialScore = getOfficialScoreLabel(match);
  const userPredictionScore = getUserPredictionScoreLabel(prediction);
  const pointsLabel = getPointsLabel(prediction, match);
  const scoreContext =
    match?.status === "encerrado" ? "Placar final" : match?.status === "ao_vivo" ? "Ao vivo" : "Placar oficial";
  const breakdown = calculatePredictionBreakdown({ displayStatus, match, prediction });

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
              <Text style={styles.scoreContext}>{scoreContext}</Text>
              <Text style={[styles.scoreText, compact && styles.scoreTextCompact]}>{officialScore}</Text>
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
          <Text style={styles.scoreContext}>{scoreContext}</Text>
          <Text style={[styles.scoreText, compact && styles.scoreTextCompact]}>{officialScore}</Text>
        </View>
      ) : null}

      <View style={[styles.predictionSummary, compact && styles.predictionSummaryCompact]}>
        <View style={styles.predictionScoreBox}>
          <Text style={styles.predictionSummaryLabel}>Seu palpite</Text>
          <Text style={styles.predictionScoreText}>{userPredictionScore}</Text>
        </View>
        <View
          style={[
            styles.pointsBadge,
            prediction.points && prediction.points > 0 ? styles.pointsBadgePositive : styles.pointsBadgeNeutral
          ]}
        >
          <Text
            style={[
              styles.pointsText,
              compact && styles.pointsTextCompact,
              prediction.points && prediction.points > 0 ? styles.pointsPositive : styles.pointsNeutral
            ]}
          >
            {pointsLabel}
          </Text>
        </View>
      </View>

      <View style={[styles.detailsGrid, compact ? styles.detailsGridCompact : styles.detailsGridWide]}>
        <PredictionDetail
          basis={detailBasis}
          compact={compact}
          label="Vencedor"
          points={breakdown.score}
          value={winnerLabel(prediction.predicted_winner, match)}
        />

        <PredictionDetail
          basis={detailBasis}
          compact={compact}
          label="Primeiro gol"
          points={breakdown.firstScorer}
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

        <PredictionDetail
          basis={detailBasis}
          compact={compact}
          label="Ambos marcam"
          points={breakdown.bothTeamsScore}
          value={boolLabel(prediction.predicted_both_teams_score)}
        />

        <PredictionDetail
          basis={detailBasis}
          compact={compact}
          label="MVP"
          points={breakdown.manOfMatch}
          value={
            resolvePredictionPlayerLabel({
              playerId: prediction.predicted_man_of_match_id,
              fallbackName: prediction.predicted_man_of_match,
              match,
              playerById
            })
          }
        />

        <PredictionDetail
          basis={detailBasis}
          compact={compact}
          label="Vermelho"
          points={breakdown.redCard}
          value={boolLabel(prediction.predicted_red_card)}
        />
      </View>
    </View>
  );
};
const styles = StyleSheet.create({
  predictionCard: {
    backgroundColor: colors.surfaceGlass,
    borderColor: colors.borderGold,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 18
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
    justifyContent: "flex-start",
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
    borderRadius: radius.lg,
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
    borderRadius: radius.lg,
    borderWidth: 1,
    minWidth: 112,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs
  },
  scoreText: {
    color: colors.gold,
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 0
  },
  scoreContext: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: "900",
    marginBottom: 2,
    textTransform: "uppercase"
  },
  scoreTextCompact: {
    fontSize: 22
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
  predictionSummaryCompact: {
    alignItems: "flex-start",
    flexDirection: "column",
    gap: spacing.xs
  },
  predictionSummaryLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  predictionScoreBox: {
    flex: 1,
    gap: 2,
    minWidth: 150
  },
  predictionScoreText: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900"
  },
  pointsBadge: {
    alignItems: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  pointsBadgePositive: {
    backgroundColor: colors.greenSoft,
    borderColor: colors.greenBorder
  },
  pointsBadgeNeutral: {
    backgroundColor: colors.whiteSoft,
    borderColor: colors.border
  },
  pointsText: {
    fontSize: 15,
    fontWeight: "900"
  },
  pointsTextCompact: {
    alignSelf: "flex-start"
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
    justifyContent: "flex-start"
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
  detailItemCompact: {
    minWidth: 0,
    width: "100%"
  },
  detailLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  detailValue: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 4
  },
  detailPointsBadge: {
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    borderWidth: 1,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xs,
    paddingVertical: 3
  },
  detailPointsBadgeMissing: {
    backgroundColor: colors.amberSoft,
    borderColor: colors.amberBorder
  },
  detailPointsBadgeNeutral: {
    backgroundColor: colors.whiteSoft,
    borderColor: colors.border
  },
  detailPointsBadgePending: {
    backgroundColor: colors.whiteSoft,
    borderColor: colors.border
  },
  detailPointsBadgePositive: {
    backgroundColor: colors.greenSoft,
    borderColor: colors.greenBorder
  },
  detailPointsText: {
    fontSize: 11,
    fontWeight: "900"
  },
  detailPointsTextMissing: {
    color: colors.amber
  },
  detailPointsTextNeutral: {
    color: colors.muted
  },
  detailPointsTextPending: {
    color: colors.mutedStrong
  },
  detailPointsTextPositive: {
    color: colors.green
  }
});
