import { useMemo } from "react";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  CalendarCheck,
  CalendarDays,
  ChevronRight,
  ListChecks,
  Medal,
  RadioTower,
  ShieldCheck,
  Target,
  Trophy,
  Users
} from "lucide-react-native";
import type { AppInvite, Group, Match, Notification, Prediction, Profile, Ranking, Tournament } from "../shared";
import { calculateMatchStatus, deriveUserPerformance, isKnockoutPlaceholder } from "../shared";
import { MatchCard } from "../components/MatchCard";
import {
  AppButton,
  Card,
  MetricTile,
  Pill,
  ScreenScroll,
  SectionTitle,
  Subtitle,
  Title
} from "../components/ui";
import { colors, radius, spacing } from "../theme/tokens";

export const HomeScreen = ({
  appInvites,
  groups,
  matches,
  notifications,
  onDetails,
  onEditProfile,
  onPredict,
  onViewGames,
  onViewGroups,
  onViewPredictions,
  onViewRanking,
  position,
  predictionLockMinutes,
  predictions,
  profile,
  ranking,
  tournaments
}: {
  appInvites: AppInvite[];
  groups: Group[];
  matches: Match[];
  notifications: Notification[];
  onDetails: (match: Match) => void;
  onEditProfile: () => void;
  onPredict: (match: Match) => void;
  onRefresh: () => Promise<void>;
  onToast: (message: string, tone?: "success" | "error" | "warning" | "info") => void;
  onViewGames: () => void;
  onViewGroups: () => void;
  onViewPredictions: () => void;
  onViewRanking: () => void;
  position: number | null;
  predictionLockMinutes: number;
  predictions: Prediction[];
  profile: Profile;
  ranking: Ranking | null;
  tournaments: Tournament[];
}) => {
  const worldCupMatches = useMemo(
    () => matches.filter((match) => match.championship === "world_cup_2026"),
    [matches],
  );
  const visibleMatches = worldCupMatches.length ? worldCupMatches : matches;
  const predictedMatchIds = new Set(predictions.map((prediction) => prediction.match_id));
  const rowsByStatus = visibleMatches.map((match) => ({
    match,
    status: calculateMatchStatus(match, new Date(), predictionLockMinutes)
  }));
  const liveMatches = rowsByStatus.filter((row) => row.status === "ao_vivo").map((row) => row.match);
  const openUnpredicted = rowsByStatus.find((row) =>
    row.status === "aberto"
    && !predictedMatchIds.has(row.match.id)
    && !isKnockoutPlaceholder(row.match.home_team)
    && !isKnockoutPlaceholder(row.match.away_team)
  )?.match ?? null;
  const upcomingMatches = rowsByStatus.filter((row) => row.status !== "encerrado").map((row) => row.match);
  const nextMatch = openUnpredicted ?? upcomingMatches[0] ?? visibleMatches[0] ?? null;
  const performance = deriveUserPerformance({ matches, predictions, ranking });
  const initials = profile.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const positionLabel = position ? `#${position}` : "-";
  const totalPoints = ranking?.total_points ?? 0;
  const nextActionTitle = openUnpredicted ? "Palpite aberto" : nextMatch ? "Acompanhe o calendario" : "Tudo em dia";
  const nextActionBody = openUnpredicted
    ? "Voce tem uma partida disponivel para palpitar agora."
    : nextMatch
      ? "Veja os proximos jogos e acompanhe as janelas de palpite."
      : "Nenhuma partida disponivel neste momento.";

  return (
    <ScreenScroll>
      <Card variant="hero">
        <View style={styles.heroTop}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.userInfo}>
            <Pill tone="gold">Painel competitivo</Pill>
            <Title>{profile.name}</Title>
            <Subtitle>{profile.email}</Subtitle>
          </View>
        </View>

        <View style={styles.heroScoreRow}>
          <View style={styles.heroScoreBlock}>
            <Text style={styles.heroScoreLabel}>Posicao</Text>
            <Text style={styles.heroScoreValue}>{positionLabel}</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroScoreBlock}>
            <Text style={styles.heroScoreLabel}>Pontos</Text>
            <Text style={styles.heroScoreValue}>{totalPoints}</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroScoreBlock}>
            <Text style={styles.heroScoreLabel}>Acerto</Text>
            <Text style={styles.heroScoreValue}>{performance.hitRate}%</Text>
          </View>
        </View>

        <View style={styles.metrics}>
          <MetricTile icon={<Medal color={colors.gold} size={18} />} label="Ranking" tone="gold" value={positionLabel} />
          <MetricTile icon={<CalendarCheck color={colors.green} size={18} />} label="Palpites" value={predictions.length} />
          <MetricTile icon={<Users color={colors.blue} size={18} />} label="Ligas" tone="blue" value={groups.length} />
          <MetricTile icon={<ShieldCheck color={colors.gold} size={18} />} label="Convites" tone="gold" value={appInvites.length} />
        </View>

        <AppButton
          compact
          icon={<ChevronRight color={colors.text} size={16} />}
          onPress={onEditProfile}
          title="Ver perfil completo"
          variant="ghost"
        />
      </Card>

      <Card style={styles.actionCard}>
        <View style={styles.actionIcon}>
          {openUnpredicted ? <Target color={colors.black} size={20} /> : <CalendarDays color={colors.black} size={20} />}
        </View>
        <View style={styles.actionCopy}>
          <Text style={styles.actionTitle}>{nextActionTitle}</Text>
          <Text style={styles.actionBody}>{nextActionBody}</Text>
        </View>
        <AppButton
          compact
          onPress={() => (openUnpredicted ? onPredict(openUnpredicted) : onViewGames())}
          title={openUnpredicted ? "Palpitar" : "Ver jogos"}
        />
      </Card>

      {liveMatches.length ? (
        <>
          <SectionTitle title="Ao vivo agora" />
          <View style={styles.matchList}>
            {liveMatches.slice(0, 2).map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                onDetails={() => onDetails(match)}
                onPredict={() => onPredict(match)}
                onOpenPredictions={onViewPredictions}
                predictionActionMode="redirect"
                predictionLockMinutes={predictionLockMinutes}
                prediction={predictions.find((item) => item.match_id === match.id)}
              />
            ))}
          </View>
        </>
      ) : null}

      <SectionTitle title="Proxima partida" />
      <View style={styles.matchList}>
        {nextMatch ? (
          <MatchCard
            match={nextMatch}
            onDetails={() => onDetails(nextMatch)}
            onPredict={() => onPredict(nextMatch)}
            onOpenPredictions={onViewPredictions}
            predictionActionMode="redirect"
            predictionLockMinutes={predictionLockMinutes}
            prediction={predictions.find((item) => item.match_id === nextMatch.id)}
          />
        ) : (
          <Card variant="soft">
            <Text style={styles.muted}>Nenhuma partida disponivel agora.</Text>
          </Card>
        )}
      </View>

      <SectionTitle title="Acesso rapido" />
      <View style={styles.shortcutGrid}>
        <Shortcut icon={<CalendarDays color={colors.gold} size={18} />} label="Jogos" onPress={onViewGames} />
        <Shortcut icon={<ListChecks color={colors.gold} size={18} />} label="Palpites" onPress={onViewPredictions} />
        <Shortcut icon={<Trophy color={colors.gold} size={18} />} label="Ranking" onPress={onViewRanking} />
        <Shortcut icon={<Users color={colors.gold} size={18} />} label="Ligas" onPress={onViewGroups} />
      </View>

      {tournaments.length ? (
        <Card variant="soft">
          <Text style={styles.tournamentText}>
            {tournaments.length} campeonato(s) ativo(s) para acompanhar no bolao.
          </Text>
        </Card>
      ) : null}

      {notifications.length ? (
        <>
          <SectionTitle title="Atualizacoes" />
          <Card variant="soft">
            {notifications.slice(0, 3).map((notification, index) => (
              <View key={notification.id} style={[styles.noticeRow, index === 0 && styles.noticeRowFirst]}>
                <Text style={styles.noticeTitle}>{notification.title}</Text>
                <Text style={styles.noticeBody}>{notification.body}</Text>
              </View>
            ))}
          </Card>
        </>
      ) : null}
    </ScreenScroll>
  );
};

const Shortcut = ({
  icon,
  label,
  onPress
}: {
  icon: ReactNode;
  label: string;
  onPress: () => void;
}) => (
  <AppButton
    compact
    icon={icon}
    onPress={onPress}
    title={label}
    variant="surface"
  />
);

const styles = StyleSheet.create({
  heroTop: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md
  },
  avatar: {
    alignItems: "center",
    backgroundColor: colors.gold,
    borderColor: colors.goldHighlight,
    borderRadius: radius.lg,
    borderWidth: 1,
    height: 64,
    justifyContent: "center",
    width: 64
  },
  avatarText: {
    color: colors.black,
    fontSize: 22,
    fontWeight: "900"
  },
  userInfo: {
    flex: 1,
    gap: 5,
    minWidth: 0
  },
  heroScoreRow: {
    alignItems: "center",
    backgroundColor: "rgba(7, 11, 19, 0.42)",
    borderColor: colors.borderGold,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    marginTop: spacing.md,
    padding: spacing.sm
  },
  heroScoreBlock: {
    alignItems: "center",
    flex: 1,
    gap: 2
  },
  heroScoreLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  heroScoreValue: {
    color: colors.gold,
    fontSize: 24,
    fontWeight: "900"
  },
  heroDivider: {
    backgroundColor: colors.border,
    height: 34,
    width: 1
  },
  metrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginVertical: spacing.md
  },
  actionCard: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  actionIcon: {
    alignItems: "center",
    backgroundColor: colors.gold,
    borderRadius: radius.md,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  actionCopy: {
    flex: 1,
    minWidth: 190
  },
  actionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900"
  },
  actionBody: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    marginTop: 3
  },
  shortcutGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  matchList: {
    gap: spacing.sm
  },
  tournamentText: {
    color: colors.mutedStrong,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 20
  },
  noticeRow: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingVertical: spacing.sm
  },
  noticeRowFirst: {
    borderTopWidth: 0,
    paddingTop: 0
  },
  noticeTitle: {
    color: colors.text,
    fontWeight: "900"
  },
  noticeBody: {
    color: colors.muted,
    lineHeight: 20,
    marginTop: 4
  },
  muted: {
    color: colors.muted,
    lineHeight: 21
  }
});
