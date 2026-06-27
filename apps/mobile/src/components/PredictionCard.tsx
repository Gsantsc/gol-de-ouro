import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import type { Match, Player, Prediction, PredictionWinner } from "../shared";
import {
  calculatePredictionBreakdown,
  getPredictionStatusLabel,
  getPredictionStatusTone,
  getTeamDisplayName,
  isPlayerEligibleForMatch,
  type ExtraScoringStatus,
  type PredictionDisplayStatus,
  type PredictionPointsBreakdown,
  type ScoringStatus
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

const getUserPredictionScoreLabel = (prediction: Prediction) =>
  `${safeNumberLabel(prediction.predicted_home_score)} x ${safeNumberLabel(prediction.predicted_away_score)}`;

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

const isScoredStatus = (status: PredictionDisplayStatus) =>
  status === "scored_win" || status === "scored_zero";

const scoredPointsLabel = (points: number) => (points > 0 ? `+${points} pts` : "0 pts");

const pointsTextFor = (points: number, pending: boolean) =>
  pending ? "Aguardando resultado" : scoredPointsLabel(points);

const resultToneFor = (status: ScoringStatus | ExtraScoringStatus) => {
  if (status === "hit") return "hit";
  if (status === "pending") return "pending";
  if (status === "no_official_data" || status === "not_applicable") return "info";
  return "miss";
};

const resultMarkFor = (status: ScoringStatus | ExtraScoringStatus) => {
  if (status === "hit") return "OK";
  if (status === "pending") return "...";
  if (status === "no_official_data" || status === "not_applicable") return "-";
  return "0";
};

const officialMarketsFor = (match: Match) => ({
  awayScore: Number(match.away_score ?? 0),
  firstScorer: match.first_goal_scorer,
  firstScorerId: match.first_goal_scorer_id,
  homeScore: Number(match.home_score ?? 0),
  manOfMatch: match.man_of_match,
  manOfMatchId: match.man_of_match_id
});

const predictionMarketsFor = (prediction: Prediction) => ({
  awayScore: Number(prediction.predicted_away_score ?? 0),
  bothTeamsScore: prediction.predicted_both_teams_score,
  firstScorer: prediction.predicted_first_scorer,
  firstScorerId: prediction.predicted_first_scorer_id,
  homeScore: Number(prediction.predicted_home_score ?? 0),
  manOfMatch: prediction.predicted_man_of_match,
  manOfMatchId: prediction.predicted_man_of_match_id,
  winner: prediction.predicted_winner
});

const resolvePredictionPlayerLabel = ({
  fallbackName,
  match,
  playerById,
  playerId
}: {
  fallbackName?: string | null;
  match: Match | null;
  playerById: Map<string, Player>;
  playerId?: string | null;
}) => {
  const player = playerById.get(playerId ?? "");

  if (player && match && isPlayerEligibleForMatch(player, match)) return player.name;
  if (player && match && !isPlayerEligibleForMatch(player, match)) return "Jogador invalido para esta partida";

  return fallbackName?.trim() || "Nao selecionado";
};

const firstScorerValue = ({
  breakdown,
  match,
  playerById,
  prediction,
  scored
}: {
  breakdown: PredictionPointsBreakdown | null;
  match: Match | null;
  playerById: Map<string, Player>;
  prediction: Prediction;
  scored: boolean;
}) => {
  if (scored && breakdown?.extras.firstScorer.status === "not_applicable") return "Nao se aplica";
  if (scored && breakdown?.extras.firstScorer.status === "no_official_data") return "Sem dado oficial";
  return resolvePredictionPlayerLabel({
    fallbackName: prediction.predicted_first_scorer,
    match,
    playerById,
    playerId: prediction.predicted_first_scorer_id
  });
};

const manOfMatchValue = ({
  breakdown,
  match,
  playerById,
  prediction,
  scored
}: {
  breakdown: PredictionPointsBreakdown | null;
  match: Match | null;
  playerById: Map<string, Player>;
  prediction: Prediction;
  scored: boolean;
}) => {
  if (scored && breakdown?.extras.manOfMatch.status === "no_official_data") return "Sem dado oficial";
  return resolvePredictionPlayerLabel({
    fallbackName: prediction.predicted_man_of_match,
    match,
    playerById,
    playerId: prediction.predicted_man_of_match_id
  });
};

const BreakdownRow = ({
  label,
  pointsLabel,
  status,
  value
}: {
  label: string;
  pointsLabel: string;
  status: ScoringStatus | ExtraScoringStatus;
  value: string;
}) => {
  const tone = resultToneFor(status);

  return (
    <View style={styles.breakdownRow}>
      <View
        style={[
          styles.resultMark,
          tone === "hit" && styles.resultMarkHit,
          tone === "miss" && styles.resultMarkMiss,
          tone === "pending" && styles.resultMarkPending,
          tone === "info" && styles.resultMarkInfo
        ]}
      >
        <Text
          style={[
            styles.resultMarkText,
            tone === "hit" && styles.resultMarkTextHit,
            tone === "miss" && styles.resultMarkTextMiss,
            tone === "pending" && styles.resultMarkTextPending,
            tone === "info" && styles.resultMarkTextInfo
          ]}
        >
          {resultMarkFor(status)}
        </Text>
      </View>
      <View style={styles.breakdownTextBox}>
        <Text style={styles.breakdownLabel}>{label}</Text>
        <Text numberOfLines={2} style={styles.breakdownValue}>{value}</Text>
      </View>
      <Text style={[styles.breakdownPoints, status === "hit" ? styles.breakdownPointsHit : styles.breakdownPointsMuted]}>
        {pointsLabel}
      </Text>
    </View>
  );
};

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
  const statusLabel = getPredictionStatusLabel(displayStatus);
  const statusTone = getPredictionStatusTone(displayStatus);
  const officialScore = getOfficialScoreLabel(match);
  const userPredictionScore = getUserPredictionScoreLabel(prediction);
  const scoreContext =
    match?.status === "encerrado" ? "Placar final" : match?.status === "ao_vivo" ? "Ao vivo" : "Placar oficial";
  const scored = Boolean(match && isScoredStatus(displayStatus));
  const breakdown = match && scored
    ? calculatePredictionBreakdown(officialMarketsFor(match), predictionMarketsFor(prediction))
    : null;
  const totalPoints = scored ? Number(prediction.points ?? 0) : 0;
  const pointsLabel = scored ? `${totalPoints} pts` : getPointsLabel(prediction, match);
  const mainStatus = breakdown?.main.status ?? "pending";
  const firstScorerStatus = breakdown?.extras.firstScorer.status ?? "pending";
  const bothTeamsStatus = breakdown?.extras.bothTeamsScore.status ?? "pending";
  const manOfMatchStatus = breakdown?.extras.manOfMatch.status ?? "pending";

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
            totalPoints > 0 ? styles.pointsBadgePositive : styles.pointsBadgeNeutral
          ]}
        >
          <Text
          style={[
            styles.pointsText,
            compact && styles.pointsTextCompact,
            totalPoints > 0 ? styles.pointsPositive : styles.pointsNeutral
          ]}
        >
          <Text style={styles.pointsBadgeLabel}>Total </Text>
          {pointsLabel}
        </Text>
      </View>
      </View>

      <View style={styles.breakdownBox}>
        <Text style={styles.breakdownSectionTitle}>Palpite Principal</Text>
        <BreakdownRow
          label={breakdown?.main.label ?? "Aguardando resultado"}
          pointsLabel={pointsTextFor(breakdown?.main.points ?? 0, !scored)}
          status={mainStatus}
          value={`${userPredictionScore} - ${winnerLabel(prediction.predicted_winner, match)}`}
        />

        <Text style={[styles.breakdownSectionTitle, styles.breakdownSectionSpacing]}>Extras</Text>
        <BreakdownRow
          label="Primeiro gol"
          pointsLabel={pointsTextFor(breakdown?.extras.firstScorer.points ?? 0, !scored)}
          status={firstScorerStatus}
          value={firstScorerValue({ breakdown, match, playerById, prediction, scored })}
        />
        <BreakdownRow
          label="Ambos marcam"
          pointsLabel={pointsTextFor(breakdown?.extras.bothTeamsScore.points ?? 0, !scored)}
          status={bothTeamsStatus}
          value={boolLabel(prediction.predicted_both_teams_score)}
        />
        <BreakdownRow
          label="Craque"
          pointsLabel={pointsTextFor(breakdown?.extras.manOfMatch.points ?? 0, !scored)}
          status={manOfMatchStatus}
          value={manOfMatchValue({ breakdown, match, playerById, prediction, scored })}
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
  pointsBadgeLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase"
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
  breakdownBox: {
    backgroundColor: colors.surfaceDeep,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.sm
  },
  breakdownSectionTitle: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  breakdownSectionSpacing: {
    marginTop: spacing.xs
  },
  breakdownRow: {
    alignItems: "center",
    backgroundColor: colors.whiteSoft,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.xs,
    minHeight: 52,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs
  },
  breakdownTextBox: {
    flex: 1,
    minWidth: 0
  },
  breakdownLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  breakdownValue: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2
  },
  breakdownPoints: {
    flexShrink: 0,
    fontSize: 12,
    fontWeight: "900",
    textAlign: "right"
  },
  breakdownPointsHit: {
    color: colors.green
  },
  breakdownPointsMuted: {
    color: colors.mutedStrong
  },
  resultMark: {
    alignItems: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 28,
    justifyContent: "center",
    width: 34
  },
  resultMarkHit: {
    backgroundColor: colors.greenSoft,
    borderColor: colors.greenBorder
  },
  resultMarkInfo: {
    backgroundColor: colors.goldSoft,
    borderColor: colors.borderGoldStrong
  },
  resultMarkMiss: {
    backgroundColor: colors.whiteSoft,
    borderColor: colors.border
  },
  resultMarkPending: {
    backgroundColor: colors.blueSoft,
    borderColor: colors.blueBorder
  },
  resultMarkText: {
    fontSize: 10,
    fontWeight: "900"
  },
  resultMarkTextHit: {
    color: colors.green
  },
  resultMarkTextInfo: {
    color: colors.gold
  },
  resultMarkTextMiss: {
    color: colors.muted
  },
  resultMarkTextPending: {
    color: colors.blue
  }
});
