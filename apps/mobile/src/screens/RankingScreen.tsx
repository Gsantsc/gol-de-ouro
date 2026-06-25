import { Pressable, StyleSheet, Text, View } from "react-native";
import { useState } from "react";
import { Crown, Medal, TrendingUp, Trophy } from "lucide-react-native";
import type { Group, GroupMember, Ranking } from "../shared";
import { Card, EmptyState, ScreenScroll, SectionTitle } from "../components/ui";
import { colors, radius, spacing } from "../theme/tokens";

const medalColors = [colors.gold, colors.silver, colors.bronze];

const initialsFor = (name?: string) =>
  (name ?? "Participante")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const xpFor = (item: Ranking) => item.total_points * 10 + item.correct_results * 4 + item.exact_scores * 12;

type RankingTab = "global" | "worldCup" | "friends" | "leagues";

export const RankingScreen = ({
  competitionRanking = [],
  groups = [],
  members = [],
  ranking,
  userId
}: {
  competitionRanking?: Ranking[];
  groups?: Group[];
  members?: GroupMember[];
  ranking: Ranking[];
  userId?: string;
}) => {
  const [tab, setTab] = useState<RankingTab>("global");
  const myGroupIds = new Set(
    members.filter((member) => member.user_id === userId).map((member) => member.group_id),
  );
  const friendUserIds = new Set(
    members
      .filter((member) => myGroupIds.has(member.group_id) && member.user_id !== userId)
      .map((member) => member.user_id),
  );
  const friendsRanking = ranking.filter((item) => friendUserIds.has(item.user_id));
  const myGroups = groups.filter((group) => myGroupIds.has(group.id));
  const topThree = ranking.slice(0, 3);
  const myRanking = ranking.find((item) => item.user_id === userId) ?? null;
  const myPosition = myRanking ? ranking.findIndex((item) => item.user_id === userId) + 1 : null;

  return (
    <ScreenScroll>
      <SectionTitle title="Ranking" />
      {ranking.length ? (
        <Card variant="hero">
          <View style={styles.podiumHeader}>
            <View>
              <Text style={styles.podiumKicker}>Destaques</Text>
              <Text style={styles.podiumTitle}>Top 3 da liga</Text>
            </View>
            <Trophy color={colors.gold} size={22} />
          </View>
          <View style={styles.podium}>
            {topThree.map((item, index) => (
              <View key={item.id} style={[styles.podiumItem, index === 0 && styles.podiumWinner]}>
                <View style={[styles.medal, { backgroundColor: medalColors[index] ?? colors.green }]}>
                  {index === 0 ? (
                    <Crown color={colors.black} size={18} />
                  ) : (
                    <Text style={styles.medalText}>{index + 1}</Text>
                  )}
                </View>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initialsFor(item.user?.name)}</Text>
                </View>
                <Text numberOfLines={1} style={styles.podiumName}>{item.user?.name ?? "Participante"}</Text>
                <Text style={styles.podiumPoints}>{item.total_points} pts</Text>
                <Text style={styles.xp}>{xpFor(item)} XP</Text>
              </View>
            ))}
          </View>
        </Card>
      ) : (
        <EmptyState
          title="Ranking vazio"
          body="O ranking será preenchido automaticamente após os primeiros palpites pontuarem."
        />
      )}

      {myRanking ? (
        <Card style={styles.myCard}>
          <View style={styles.myCardHeader}>
            <View>
              <Text style={styles.myKicker}>Sua campanha</Text>
              <Text style={styles.myTitle}>{myRanking.user?.name ?? "Voce"}</Text>
            </View>
            <View style={styles.myPositionBadge}>
              <Text style={styles.myPositionText}>#{myPosition}</Text>
            </View>
          </View>
          <View style={styles.myStats}>
            <View style={styles.myStat}>
              <Text style={styles.myStatValue}>{myRanking.total_points}</Text>
              <Text style={styles.myStatLabel}>pontos</Text>
            </View>
            <View style={styles.myStat}>
              <Text style={styles.myStatValue}>{myRanking.exact_scores}</Text>
              <Text style={styles.myStatLabel}>exatos</Text>
            </View>
            <View style={styles.myStat}>
              <Text style={styles.myStatValue}>{myRanking.correct_results}</Text>
              <Text style={styles.myStatLabel}>resultados</Text>
            </View>
          </View>
        </Card>
      ) : null}

      <View style={styles.tabs}>
       {[
  { id: "global", label: "Global" },
  { id: "worldCup", label: "Copa 2026" },
  { id: "friends", label: "Amigos" },
  { id: "leagues", label: "Minhas Ligas" }
].map((item) => {
          const active = tab === item.id;

          return (
            <Pressable
              key={item.id}
              onPress={() => setTab(item.id as RankingTab)}
              style={[styles.tab, active && styles.tabActive]}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {tab === "global" && <RankingList ranking={ranking} title="Ranking Global" userId={userId} />}

{tab === "worldCup" && (
  <RankingList
    ranking={competitionRanking}
    title="Ranking Copa do Mundo 2026"
    userId={userId}
  />
)}

{tab === "friends" && <RankingList ranking={friendsRanking} title="Amigos" userId={userId} />}

      {tab === "leagues" && (
        <>
          <SectionTitle title="Minhas Ligas" />
      {myGroups.length ? (
        myGroups.map((group) => {
          const groupUserIds = new Set(
            members.filter((member) => member.group_id === group.id).map((member) => member.user_id),
          );
          const groupRanking = ranking.filter((item) => groupUserIds.has(item.user_id));

          return (
            <RankingList
              key={group.id}
              ranking={groupRanking}
              title={group.name}
              userId={userId}
            />
          );
        })
      ) : (
        <Card variant="soft">
          <Text style={styles.emptyText}>Entre em ligas para comparar sua pontuação com amigos.</Text>
        </Card>
      )}
        </>
      )}
    </ScreenScroll>
  );
};

const RankingList = ({ ranking, title, userId }: { ranking: Ranking[]; title: string; userId?: string }) => (
  <Card>
    <View style={styles.listHeader}>
      <View>
        <Text style={styles.listTitle}>{title}</Text>
        <Text style={styles.listSubtitle}>{ranking.length} participantes</Text>
      </View>
      <Trophy color={colors.gold} size={20} />
    </View>
    {ranking.length ? (
      ranking.map((item, index) => {
        const mine = item.user_id === userId;
        const progress = Math.min(100, xpFor(item) % 100);
        return (
          <View key={item.id} style={[styles.row, mine && styles.rowMine]}>
            <View style={styles.position}>
              {index < 3 ? (
                <Medal color={medalColors[index]} size={17} />
              ) : (
                <Text style={styles.positionText}>{index + 1}</Text>
              )}
            </View>
            <View style={styles.avatarSmall}>
              <Text style={styles.avatarSmallText}>{initialsFor(item.user?.name)}</Text>
            </View>
            <View style={styles.user}>
              <View style={styles.nameRow}>
                <Text numberOfLines={1} style={styles.name}>{item.user?.name ?? "Participante"}</Text>
                {mine ? <Text style={styles.mineTag}>você</Text> : null}
              </View>
              <Text style={styles.detail}>
                {item.correct_results} acertos - {item.exact_scores} exatos - {xpFor(item)} XP
              </Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressBar, { width: `${progress}%` }]} />
              </View>
            </View>
            <View style={styles.pointsBox}>
              <TrendingUp color={colors.gold} size={14} />
              <Text style={styles.points}>{item.total_points}</Text>
            </View>
          </View>
        );
      })
    ) : (
      <Text style={styles.emptyText}>Sem pontuação ainda.</Text>
    )}
  </Card>
);

const styles = StyleSheet.create({
  podiumHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.md
  },
  podiumKicker: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  podiumTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 2
  },
  podium: {
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between"
  },
  podiumItem: {
    alignItems: "center",
    flex: 1,
    gap: spacing.xs,
    paddingVertical: spacing.sm
  },
  podiumWinner: {
    transform: [{ translateY: -5 }]
  },
  medal: {
    alignItems: "center",
    borderRadius: radius.pill,
    height: 30,
    justifyContent: "center",
    width: 30
  },
  medalText: {
    color: colors.black,
    fontWeight: "900"
  },
  avatar: {
    alignItems: "center",
    backgroundColor: "rgba(11, 15, 25, 0.5)",
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    borderWidth: 1,
    height: 54,
    justifyContent: "center",
    width: 54
  },
  avatarText: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900"
  },
  podiumName: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "900",
    maxWidth: 92,
    textAlign: "center"
  },
  podiumPoints: {
    color: colors.gold,
    fontSize: 14,
    fontWeight: "900"
  },
  tabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  tab: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  tabActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold
  },
  tabText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "900",
    textAlign: "center"
  },
  tabTextActive: {
    color: colors.black
  },
  xp: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: "900"
  },
  myCard: {
    gap: spacing.md
  },
  myCardHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  myKicker: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  myTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 2
  },
  myPositionBadge: {
    alignItems: "center",
    backgroundColor: colors.gold,
    borderRadius: radius.pill,
    justifyContent: "center",
    minWidth: 54,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  myPositionText: {
    color: colors.black,
    fontSize: 16,
    fontWeight: "900"
  },
  myStats: {
    flexDirection: "row",
    gap: spacing.sm
  },
  myStat: {
    backgroundColor: colors.whiteSoft,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexGrow: 1,
    flexBasis: 142,
    padding: spacing.sm
  },
  myStatValue: {
    color: colors.gold,
    fontSize: 20,
    fontWeight: "900"
  },
  myStatLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 2
  },
  listHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.sm
  },
  listTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900"
  },
  listSubtitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2
  },
  row: {
    alignItems: "center",
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 72,
    paddingVertical: spacing.sm
  },
  rowMine: {
    backgroundColor: colors.goldSoft,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs
  },
  position: {
    alignItems: "center",
    height: 30,
    justifyContent: "center",
    width: 28
  },
  positionText: {
    color: colors.gold,
    fontWeight: "900"
  },
  avatarSmall: {
    alignItems: "center",
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    height: 36,
    justifyContent: "center",
    width: 36
  },
  avatarSmallText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "900"
  },
  user: {
    flex: 1,
    minWidth: 0
  },
  nameRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs
  },
  name: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    fontWeight: "900"
  },
  mineTag: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  detail: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 3
  },
  progressTrack: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: radius.pill,
    height: 4,
    marginTop: spacing.xs,
    overflow: "hidden"
  },
  progressBar: {
    backgroundColor: colors.gold,
    borderRadius: radius.pill,
    height: 4
  },
  pointsBox: {
    alignItems: "center",
    flexDirection: "row",
    gap: 3,
    minWidth: 52,
    justifyContent: "flex-end"
  },
  points: {
    color: colors.gold,
    fontSize: 18,
    fontWeight: "900"
  },
  emptyText: {
    color: colors.muted,
    lineHeight: 21
  }
});
