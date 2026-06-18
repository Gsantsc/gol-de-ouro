import { useMemo, useState } from "react";
import { Share, StyleSheet, Text, View } from "react-native";
import { Bell, CalendarCheck, ChevronRight, Copy, Medal, RadioTower, Share2, UserPlus, Users, XCircle } from "lucide-react-native";
import type { AppInvite, Group, Match, Notification, Prediction, Profile, Ranking, Tournament } from "../shared";
import { calculateMatchStatus, deriveUserPerformance, formatDateTimePtBr } from "../shared";
import { MatchCard } from "../components/MatchCard";
import {
  AppButton,
  Card,
  Eyebrow,
  Field,
  MetricTile,
  ScreenScroll,
  SectionTitle,
  Subtitle,
  Title
} from "../components/ui";
import { createAppInvite, createGroup, revokeAppInvite } from "../services/football.service";
import { colors, radius, spacing } from "../theme/tokens";

export const HomeScreen = ({
  appInvites,
  groups,
  matches,
  notifications,
  onDetails,
  onEditProfile,
  onPredict,
  onRefresh,
  onToast,
  onViewGames,
  onViewGroups,
  onViewPredictions,
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
  position: number | null;
  predictionLockMinutes: number;
  predictions: Prediction[];
  profile: Profile;
  ranking: Ranking | null;
  tournaments: Tournament[];
}) => {
  const [groupName, setGroupName] = useState("");
  const [busy, setBusy] = useState(false);
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
  const tournamentId = tournaments.find((item) => item.slug === "world_cup_2026")?.id ?? tournaments[0]?.id;
  const performance = deriveUserPerformance({ matches, predictions, ranking });
  const initials = profile.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const showOnboarding = !predictions.length && !groups.length;
  const activeAppInvite = appInvites.find((invite) => invite.status === "pending");

  const run = async (action: () => Promise<void>, success?: string) => {
    if (busy) return;

    try {
      setBusy(true);
      await action();
      await onRefresh();
      if (success) onToast(success, "success");
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Não foi possível continuar.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenScroll>
      <Card variant="accent">
        <View style={styles.userHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.userInfo}>
            <Eyebrow>Área do usuário</Eyebrow>
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
        <View style={styles.shortcutRow}>
          <AppButton compact onPress={onViewGames} title="Ir para Jogos" />
          <AppButton compact onPress={onViewPredictions} title="Ver Palpites" variant="ghost" />
        </View>
      </Card>

      {showOnboarding ? (
        <Card variant="soft">
          <Eyebrow>NEW USER ONBOARDING</Eyebrow>
          <Text style={styles.onboardingTitle}>Primeiros passos</Text>
          <View style={styles.onboardingGrid}>
            {["Escolha um jogo", "Faca seu palpite", "Entre em ligas", "Ganhe pontos", "Suba no ranking"].map((step, index) => (
              <View key={step} style={styles.onboardingStep}>
                <Text style={styles.onboardingNumber}>{index + 1}</Text>
                <Text style={styles.onboardingText}>{step}</Text>
              </View>
            ))}
          </View>
        </Card>
      ) : null}

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

      <SectionTitle title="Bolões e convites" />
      <Card>
        <View style={styles.formGrid}>
          <View style={styles.formBlock}>
            <View style={styles.formTitleRow}>
              <Users color={colors.green} size={18} />
              <Text style={styles.formTitle}>Criar liga</Text>
            </View>
            <Field label="Nome da liga" onChangeText={setGroupName} placeholder="Liga da família" value={groupName} />
            <AppButton
              compact
              disabled={busy || !groupName || !tournamentId}
              loading={busy}
              onPress={() => run(async () => {
                await createGroup(groupName, tournamentId);
                setGroupName("");
              }, "Liga criada com sucesso.")}
              title="Criar liga"
            />
          </View>

          <View style={styles.formBlock}>
            <View style={styles.formTitleRow}>
              <UserPlus color={colors.gold} size={18} />
              <Text style={styles.formTitle}>Convidar amigo</Text>
            </View>
            {activeAppInvite ? (
              <>
                <Text style={styles.inviteLink}>{activeAppInvite.invite_url}</Text>
                <View style={styles.inviteActions}>
                  <AppButton
                    compact
                    icon={<Copy color={colors.text} size={16} />}
                    onPress={() => Share.share({ message: activeAppInvite.invite_url })}
                    title="Copiar"
                    variant="ghost"
                  />
                  <AppButton
                    compact
                    icon={<Share2 color={colors.black} size={16} />}
                    onPress={() => Share.share({ message: `Entre no Gol de Ouro: ${activeAppInvite.invite_url}` })}
                    title="Compartilhar"
                  />
                  <AppButton
                    compact
                    icon={<XCircle color={colors.text} size={16} />}
                    onPress={() => run(() => revokeAppInvite(activeAppInvite.id), "Convite revogado.")}
                    title="Revogar"
                    variant="ghost"
                  />
                </View>
              </>
            ) : (
              <AppButton
                compact
                disabled={busy}
                icon={<UserPlus color={colors.black} size={16} />}
                loading={busy}
                onPress={() => run(() => createAppInvite().then(() => undefined), "Convite do app gerado.")}
                title="Gerar link"
              />
            )}
          </View>
        </View>

        <View style={styles.groupList}>
          <AppButton
            compact
            icon={<ChevronRight color={colors.text} size={16} />}
            onPress={onViewGroups}
            title={groups.length ? "Ver minhas ligas" : "Abrir ligas"}
            variant="ghost"
          />
          {groups.slice(0, 3).map((group) => (
            <View key={group.id} style={styles.groupRow}>
              <View style={styles.groupMark} />
              <View style={styles.groupText}>
                <Text style={styles.groupName}>{group.name}</Text>
                <Text style={styles.groupMeta}>{group.tournament?.name ?? "Campeonato"}</Text>
              </View>
              <Text style={styles.groupStatus}>{group.closed_at ? "Fechado" : "Ativo"}</Text>
            </View>
          ))}
          {!groups.length && <Text style={styles.muted}>Você ainda não participa de ligas.</Text>}
        </View>
      </Card>

      <SectionTitle title="Central do jogo" />
      <Card variant="soft">
        <View style={styles.noticeHeader}>
          <Bell color={colors.gold} size={18} />
          <Text style={styles.noticeHeading}>Atualizações</Text>
        </View>
        {notifications.length ? (
          notifications.slice(0, 4).map((notification) => (
            <View key={notification.id} style={styles.noticeRow}>
              <Text style={styles.noticeTitle}>{notification.title}</Text>
              <Text style={styles.noticeBody}>{notification.body}</Text>
            </View>
          ))
        ) : nextMatch ? (
          <View key={nextMatch.id} style={styles.noticeRow}>
            <Text style={styles.noticeTitle}>Próximo jogo</Text>
            <Text style={styles.noticeBody}>
              {nextMatch.home_team} x {nextMatch.away_team} - {formatDateTimePtBr(nextMatch.start_time)}
            </Text>
          </View>
        ) : (
          <Text style={styles.muted}>Sem notificações no momento.</Text>
        )}
      </Card>
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
  onboardingTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
    marginTop: spacing.xs
  },
  onboardingGrid: {
    gap: spacing.sm,
    marginTop: spacing.md
  },
  onboardingStep: {
    alignItems: "center",
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.sm
  },
  onboardingNumber: {
    color: colors.gold,
    fontSize: 18,
    fontWeight: "900",
    width: 24
  },
  onboardingText: {
    color: colors.text,
    flex: 1,
    fontWeight: "900"
  },
  formGrid: {
    gap: spacing.md
  },
  formBlock: {
    gap: spacing.sm
  },
  formTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs
  },
  formTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900"
  },
  inviteActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs
  },
  inviteLink: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.gold,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 18,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm
  },
  groupList: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.sm
  },
  groupRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 44
  },
  groupMark: {
    backgroundColor: colors.green,
    borderRadius: radius.pill,
    height: 8,
    width: 8
  },
  groupText: {
    flex: 1
  },
  groupName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900"
  },
  groupMeta: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2
  },
  groupStatus: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: "900"
  },
  noticeHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
    marginBottom: spacing.xs
  },
  noticeHeading: {
    color: colors.text,
    fontWeight: "900"
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
