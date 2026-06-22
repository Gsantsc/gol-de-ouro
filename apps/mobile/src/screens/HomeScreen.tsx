import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { CalendarCheck, CalendarDays, ChevronRight, ListChecks, Medal, RadioTower, Users } from "lucide-react-native";
import type { AppInvite, Group, Match, Notification, Prediction, Profile, Ranking, Tournament } from "../shared";
import { calculateMatchStatus, deriveUserPerformance } from "../shared";
import { MatchCard } from "../components/MatchCard";
import {
  AppButton,
  Card,
  MetricTile,
  ScreenScroll,
  SectionTitle,
  Subtitle,
  Title
} from "../components/ui";
import { colors, radius, spacing } from "../theme/tokens";

export const HomeScreen = ({
  groups: _groups,
  matches,
  notifications,
  onDetails,
  onEditProfile,
  onPredict,
  onViewGames,
  onViewGroups,
  onViewPredictions,
  position,
  predictionLockMinutes,
  predictions,
  profile,
  ranking
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
  const upcomingMatches = visibleMatches.filter((match) => calculateMatchStatus(match, new Date(), predictionLockMinutes) !== "encerrado");
  const nextMatch =
    upcomingMatches.find((match) => calculateMatchStatus(match, new Date(), predictionLockMinutes) === "aberto" && !predictedMatchIds.has(match.id))
    ?? (upcomingMatches.length ? upcomingMatches : visibleMatches)[0]
    ?? null;
  const performance = deriveUserPerformance({ matches, predictions, ranking });
  const initials = profile.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <ScreenScroll>
      <Card variant="accent">
        <View style={styles.userHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.userInfo}>
            <Title>{profile.name}</Title>
            <Subtitle>{profile.email}</Subtitle>
          </View>
        </View>
        <View style={styles.metrics}>
          <MetricTile icon={<Medal color={colors.gold} size={18} />} label="Ranking" tone="gold" value={position ? `#${position}` : "-"} />
          <MetricTile icon={<CalendarCheck color={colors.green} size={18} />} label="Pontos" value={ranking?.total_points ?? 0} />
          <MetricTile icon={<RadioTower color={colors.blue} size={18} />} label="Acerto" tone="blue" value={`${performance.hitRate}%`} />
        </View>
        <AppButton
          compact
          icon={<ChevronRight color={colors.text} size={16} />}
          onPress={onEditProfile}
          title="Ver perfil completo"
          variant="ghost"
        />
      </Card>

      <SectionTitle title="Próximo jogo" />
      <View style={styles.matchList}>
        {nextMatch ? (
          <MatchCard
            match={nextMatch}
            onDetails={() => onDetails(nextMatch)}
            onPredict={() => onPredict(nextMatch)}
            predictionLockMinutes={predictionLockMinutes}
            prediction={predictions.find((item) => item.match_id === nextMatch.id)}
          />
        ) : (
          <Card variant="soft">
            <Text style={styles.muted}>Nenhuma partida disponível agora.</Text>
          </Card>
        )}
      </View>

      <SectionTitle title="Acesso rápido" />
      <View style={styles.shortcutRow}>
        <AppButton compact icon={<CalendarDays color={colors.black} size={16} />} onPress={onViewGames} title="Jogos" />
        <AppButton compact icon={<ListChecks color={colors.black} size={16} />} onPress={onViewPredictions} title="Palpites" />
        <AppButton compact icon={<Users color={colors.black} size={16} />} onPress={onViewGroups} title="Ligas" variant="ghost" />
      </View>

      {notifications.length ? (
        <>
          <SectionTitle title="Atualizações" />
          <Card variant="soft">
            {notifications.slice(0, 3).map((notification) => (
              <View key={notification.id} style={styles.noticeRow}>
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

const styles = StyleSheet.create({
  userHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md
  },
  avatar: {
    alignItems: "center",
    backgroundColor: colors.gold,
    borderRadius: radius.sm,
    height: 58,
    justifyContent: "center",
    width: 58
  },
  avatarText: {
    color: colors.black,
    fontSize: 20,
    fontWeight: "900"
  },
  userInfo: {
    flex: 1,
    gap: 3
  },
  metrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginVertical: spacing.md
  },
  shortcutRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.sm
  },
  matchList: {
    gap: spacing.sm
  },
  noticeRow: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingVertical: spacing.sm
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
