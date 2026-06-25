// CHAMPIONSHIPS SCREEN FIX - Display only supported championships from database
// FRONTEND LEAGUE FILTER FIX - No hardcoded fallback, use database data only
import { Share, StyleSheet, Text, View } from "react-native";
import { Copy, LogOut, Plus, Share2, Trophy, Users, XCircle } from "lucide-react-native";
import Svg, { Rect } from "react-native-svg";
import type { Group, GroupMember, Ranking, Tournament } from "../shared";
import { createQrMatrix } from "../shared";
import { useEffect, useState } from "react";
import { AppButton, Card, EmptyState, Field, MetricTile, Pill, SectionTitle, ToastBanner } from "../components/ui";
import {
  closeGroup,
  createGroup,
  deactivateGroupInvite,
  regenerateGroupInvite,
  leaveGroup,
  removeGroupMember
} from "../services/football.service";
import { colors, radius, spacing } from "../theme/tokens";

export const GroupsScreen = ({
  groups,
  initialSelectedGroupId,
  members,
  onRefresh,
  onSelectGroup,
  rankings,
  tournaments,
  userId
}: {
  groups: Group[];
  initialSelectedGroupId?: string | null;
  members: GroupMember[];
  onRefresh: () => Promise<void>;
  onSelectGroup?: (groupId: string | null) => void;
  rankings: Ranking[];
  tournaments: Tournament[];
  userId: string;
}) => {
  const [groupName, setGroupName] = useState("");
  const [championshipId, setChampionshipId] = useState(tournaments[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" | "info" } | null>(null);

  useEffect(() => {
    if (!championshipId && tournaments[0]?.id) setChampionshipId(tournaments[0].id);
  }, [championshipId, tournaments]);

  useEffect(() => {
    if (initialSelectedGroupId) setSelectedGroupId(initialSelectedGroupId);
  }, [initialSelectedGroupId]);

  const run = async (action: () => Promise<void>, success?: string) => {
    if (busy) return;

    try {
      setBusy(true);
      await action();
      await onRefresh();
      if (success) setToast({ message: success, tone: "success" });
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : "Tente novamente.", tone: "error" });
    } finally {
      setBusy(false);
    }
  };
  const inviteLinkFor = (group: Group) =>
    group.invite_url || `https://gol-de-ouro-app.vercel.app/invite/${group.invite_token || group.invite_code}`;

  const selectGroup = (groupId: string | null) => {
    setSelectedGroupId(groupId);
    onSelectGroup?.(groupId);
  };

  const copyInviteLink = async (link: string) => {
    const clipboard = globalThis.navigator?.clipboard;
    if (clipboard?.writeText) {
      await clipboard.writeText(link);
      setToast({ message: "Link copiado", tone: "success" });
      return;
    }

    await Share.share({ message: link });
  };

  return (
    <>
      {toast ? <ToastBanner message={toast.message} tone={toast.tone} /> : null}
      <Card variant="hero">
        <View style={styles.heroCopy}>
          <Pill tone="gold">Competicao entre amigos</Pill>
          <Text style={styles.heroTitle}>Ligas do bolao</Text>
          <Text style={styles.heroBody}>
            Crie grupos, compartilhe convites e acompanhe o ranking interno.
          </Text>
        </View>
        <View style={styles.heroStats}>
          <MetricTile icon={<Trophy color={colors.gold} size={18} />} label="Ligas" tone="gold" value={groups.length} />
          <MetricTile icon={<Users color={colors.blue} size={18} />} label="Participantes" tone="blue" value={members.length} />
          <MetricTile
            icon={<Share2 color={colors.green} size={18} />}
            label="Convites ativos"
            value={groups.filter((group) => group.invite_active).length}
          />
        </View>
      </Card>

      <SectionTitle title="Criar nova liga" />
      <Card>
        <View style={styles.form}>
          <Field label="Nome da liga" onChangeText={setGroupName} placeholder="Liga entre amigos" value={groupName} />
          <View style={styles.selector}>
            {tournaments.map((tournament) => (
              <Text
                key={tournament.id}
                onPress={() => setChampionshipId(tournament.id)}
                style={[styles.option, championshipId === tournament.id && styles.optionActive]}
              >
                {tournament.name}
              </Text>
            ))}
          </View>
          <AppButton
            disabled={busy || !groupName || !championshipId}
            icon={<Plus color={colors.black} size={18} />}
            loading={busy}
            onPress={() => run(async () => {
              await createGroup(groupName, championshipId);
              setGroupName("");
            }, "Liga criada com sucesso.")}
            title="Criar liga"
          />
        </View>
      </Card>

      <SectionTitle title="Minhas ligas" />
      {groups.map((group) => {
        const groupMembers = members.filter((member) => member.group_id === group.id);
        const isOwner = group.owner_id === userId;
        const rankedMembers = [...groupMembers].sort(
          (left, right) =>
            (rankings.find((ranking) => ranking.user_id === right.user_id)?.total_points ?? 0) -
            (rankings.find((ranking) => ranking.user_id === left.user_id)?.total_points ?? 0),
        );
        const selected = selectedGroupId === group.id;
        const myPosition = rankedMembers.findIndex((member) => member.user_id === userId);
        const myPoints = rankings.find((ranking) => ranking.user_id === userId)?.total_points ?? 0;
        const inviteToken = group.invite_token || group.invite_code;
        const deepLink = `goldeouro://invite/${inviteToken}`;
        const webLink = inviteLinkFor(group);

        return (
          <Card key={group.id} style={selected && styles.groupSelected}>
            <View style={styles.groupHeader}>
              <View style={styles.groupInfo}>
                <Text style={styles.groupName}>{group.name}</Text>
                <Text style={styles.groupMeta}>
                    {group.tournament?.name ?? "Campeonato"} - {groupMembers.length} participantes
                </Text>
              </View>
              {selected && webLink ? <MiniQr value={webLink} /> : null}
            </View>
            <View style={styles.leagueStats}>
              <View style={styles.leagueMetric}>
                <Text style={styles.leagueMetricValue}>{myPosition >= 0 ? `#${myPosition + 1}` : "-"}</Text>
                <Text style={styles.leagueMetricLabel}>sua posicao</Text>
              </View>
              <View style={styles.leagueMetric}>
                <Text style={styles.leagueMetricValue}>{myPoints}</Text>
                <Text style={styles.leagueMetricLabel}>seus pontos</Text>
              </View>
              <View style={styles.leagueMetric}>
                <Text style={styles.leagueMetricValue}>{groupMembers.length}</Text>
                <Text style={styles.leagueMetricLabel}>participantes</Text>
              </View>
            </View>
            <AppButton
              onPress={() => selectGroup(selected ? null : group.id)}
              title={selected ? "Fechar detalhes" : "Abrir liga"}
            />
            {selected ? (
              <>
            <View style={styles.invitePanel}>
              <Text style={styles.inviteStatus}>
                Link de convite: {group.invite_active ? "ativo" : "inativo"}
              </Text>
              <Text style={styles.link}>{deepLink}</Text>
              <Text style={styles.link}>{webLink}</Text>
            </View>
            <View style={styles.actions}>
              <AppButton
                icon={<Share2 color={colors.black} size={18} />}
                onPress={() => Share.share({ message: `${group.name}: ${deepLink}\n${webLink}` })}
                title="Compartilhar"
              />
              <AppButton
                icon={<Copy color={colors.text} size={18} />}
                onPress={() => copyInviteLink(webLink)}
                title="Copiar link"
                variant="ghost"
              />
              {isOwner ? (
                <>
                  <AppButton
                    icon={<Copy color={colors.text} size={18} />}
                    loading={busy}
                    onPress={() => run(() => regenerateGroupInvite(group.id), "Link regenerado.")}
                    title="Regenerar link"
                    variant="ghost"
                  />
                  <AppButton
                    icon={<XCircle color={colors.text} size={18} />}
                    loading={busy}
                    onPress={() => run(() => deactivateGroupInvite(group.id), "Link desativado.")}
                    title="Desativar link"
                    variant="ghost"
                  />
                </>
              ) : null}
            </View>

            <View style={styles.participants}>
              <Text style={styles.participantsTitle}>Ranking interno</Text>
              {rankedMembers.map((member, index) => {
                const points = rankings.find((ranking) => ranking.user_id === member.user_id)?.total_points ?? 0;
                return (
                  <View key={member.id} style={styles.memberRow}>
                    <Text style={styles.memberPosition}>#{index + 1}</Text>
                    <Text style={styles.memberName}>{member.user?.name ?? member.user_id}</Text>
                    <Text style={styles.memberPoints}>{points} pts</Text>
                    {isOwner && member.role !== "owner" && (
                      <Text
                        onPress={() => run(() => removeGroupMember(group.id, member.user_id))}
                        style={styles.removeMember}
                      >
                        Remover
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>

            <AppButton
              icon={isOwner ? <XCircle color={colors.text} size={18} /> : <LogOut color={colors.text} size={18} />}
              onPress={() => run(() => (isOwner ? closeGroup(group.id) : leaveGroup(group.id)))}
              title={isOwner ? "Fechar liga" : "Sair da liga"}
              variant="ghost"
            />
              </>
            ) : null}
          </Card>
        );
      })}

      <SectionTitle title="Convites" />
      {groups.map((group) => {
        const isOwner = group.owner_id === userId;
        const inviteToken = group.invite_token || group.invite_code;
        const deepLink = `goldeouro://invite/${inviteToken}`;
        const webLink = inviteLinkFor(group);

        return (
          <Card key={`invite-${group.id}`} variant="soft">
            <View style={styles.inviteCardHeader}>
              <View style={styles.groupInfo}>
                <Text style={styles.groupName}>{group.name}</Text>
                <Text style={styles.groupMeta}>
                  Link exclusivo: {group.invite_active ? "ativo" : "inativo"}
                </Text>
              </View>
              {webLink ? <MiniQr value={webLink} /> : null}
            </View>
            <View style={styles.invitePanel}>
              <Text style={styles.link}>{webLink}</Text>
              <Text style={styles.link}>{deepLink}</Text>
            </View>
            <View style={styles.actions}>
              <AppButton
                icon={<Share2 color={colors.black} size={18} />}
                onPress={() => Share.share({ message: `${group.name}: ${deepLink}\n${webLink}` })}
                title="Compartilhar"
              />
              <AppButton
                icon={<Copy color={colors.text} size={18} />}
                onPress={() => copyInviteLink(webLink)}
                title="Copiar link"
                variant="ghost"
              />
              {isOwner ? (
                <>
                  <AppButton
                    loading={busy}
                    onPress={() => run(() => regenerateGroupInvite(group.id), "Link regenerado.")}
                    title="Regenerar"
                    variant="ghost"
                  />
                  <AppButton
                    loading={busy}
                    onPress={() => run(() => deactivateGroupInvite(group.id), "Link desativado.")}
                    title="Desativar"
                    variant="ghost"
                  />
                </>
              ) : null}
            </View>
          </Card>
        );
      })}
      {!groups.length && (
        <EmptyState
          title="Nenhuma liga ainda"
          body="Crie uma liga para disputar o ranking com amigos e compartilhar o convite do bolao."
          actionLabel="Criar liga"
          onAction={() => setGroupName("")}
        />
      )}
    </>
  );
};

const MiniQr = ({ value }: { value: string }) => {
  const matrix = createQrMatrix(value || "https://gol-de-ouro-app.vercel.app");
  const size = matrix.length;

  return (
    <Svg height={82} style={styles.qr} viewBox={`0 0 ${size} ${size}`} width={82}>
      <Rect fill="#fff" height={size} width={size} x={0} y={0} />
      {matrix.map((row, rowIndex) =>
        row.map((filled, columnIndex) =>
          filled ? (
            <Rect fill="#000" height={1} key={`${rowIndex}-${columnIndex}`} width={1} x={columnIndex} y={rowIndex} />
          ) : null,
        ),
      )}
    </Svg>
  );
};

const styles = StyleSheet.create({
  heroCopy: {
    gap: spacing.xs
  },
  heroTitle: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "900",
    lineHeight: 32
  },
  heroBody: {
    color: colors.mutedStrong,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 21
  },
  heroStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.md
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginVertical: spacing.md
  },
  form: {
    gap: spacing.md
  },
  selector: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  option: {
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.muted,
    fontWeight: "800",
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  optionActive: {
    backgroundColor: colors.green,
    borderColor: colors.green,
    color: colors.black
  },
  groupHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between"
  },
  groupSelected: {
    borderColor: colors.borderGoldStrong
  },
  groupInfo: {
    flex: 1
  },
  groupName: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900"
  },
  groupMeta: {
    color: colors.muted,
    marginTop: 4
  },
  leagueStats: {
    flexDirection: "row",
    gap: spacing.sm,
    marginVertical: spacing.md
  },
  leagueMetric: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm
  },
  leagueMetricValue: {
    color: colors.gold,
    fontSize: 18,
    fontWeight: "900"
  },
  leagueMetricLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "800",
    marginTop: 2
  },
  invitePanel: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    marginTop: spacing.md,
    padding: spacing.sm
  },
  inviteCardHeader: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    justifyContent: "space-between"
  },
  inviteStatus: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "900",
    marginBottom: spacing.xs
  },
  link: {
    color: colors.gold,
    fontSize: 12,
    marginTop: spacing.sm
  },
  memberName: {
    color: colors.text,
    flex: 1,
    fontWeight: "800"
  },
  memberPoints: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: "900"
  },
  memberPosition: {
    color: colors.gold,
    fontWeight: "900",
    width: 34
  },
  memberRow: {
    alignItems: "center",
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    paddingVertical: spacing.sm
  },
  participants: {
    marginTop: spacing.sm
  },
  participantsTitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "900",
    marginBottom: spacing.xs,
    textTransform: "uppercase"
  },
  qr: {
    backgroundColor: "#fff",
    borderRadius: radius.sm,
    height: 82,
    width: 82
  },
  removeMember: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: "900"
  }
});
