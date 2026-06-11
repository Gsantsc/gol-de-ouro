// LEAGUE AUDIT
// SUPPORTED CHAMPIONSHIPS
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Plus, Swords } from "lucide-react-native";
import type { Competition, CompetitionGroup, Group } from "../shared";
import { AppButton, Card, Field, SectionTitle, ToastBanner } from "../components/ui";
import { createCompetition } from "../services/football.service";
import { colors, radius, spacing } from "../theme/tokens";
import type {
  NativeStackScreenProps,
  RootStackParamList
} from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Competitions"> & {
  competitionGroups: CompetitionGroup[];
  competitions: Competition[];
  groups: Group[];
  onRefresh: () => Promise<void>;
};

export const CompetitionsScreen = ({
  route,
  competitionGroups,
  competitions,
  groups,
  onRefresh
}: Props) => {
  const { groupMembers, rankings } = route.params ?? {};
  const [name, setName] = useState("");
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  void groupMembers;
  void rankings;

  const toggleGroup = (groupId: string) => {
    setSelectedGroups((current) =>
      current.includes(groupId)
        ? current.filter((item) => item !== groupId)
        : [...current, groupId],
    );
  };

  const submit = async () => {
    try {
      setLoading(true);
      await createCompetition(name, selectedGroups);
      setName("");
      setSelectedGroups([]);
      await onRefresh();
      setToast({ message: "Competicao criada com sucesso.", tone: "success" });
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : "Tente novamente.", tone: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {toast ? <ToastBanner message={toast.message} tone={toast.tone} /> : null}
      <SectionTitle title="Criar competição" />
      <Card>
        <View style={styles.form}>
          <Field label="Nome" onChangeText={setName} placeholder="Liga entre Amigos" value={name} />
          <View style={styles.selector}>
            {groups.map((group) => (
              <Text
                key={group.id}
                onPress={() => toggleGroup(group.id)}
                style={[styles.option, selectedGroups.includes(group.id) && styles.optionActive]}
              >
                {group.name}
              </Text>
            ))}
          </View>
          <AppButton
            disabled={loading || !name || selectedGroups.length < 2}
            icon={<Plus color={colors.black} size={18} />}
            loading={loading}
            onPress={submit}
            title="Criar competição"
          />
        </View>
      </Card>

      <SectionTitle title="Competições" />
      {competitions.map((competition) => {
        const linked = competitionGroups
          .filter((item) => item.competition_id === competition.id)
          .map((item) => groups.find((group) => group.id === item.group_id) ?? item.group)
          .filter(Boolean) as Group[];
        return (
          <Card key={competition.id}>
            <Swords color={colors.gold} size={26} />
            <Text style={styles.title}>{competition.name}</Text>
            <Text style={styles.meta}>{linked.length} grupos vinculados - {competition.status}</Text>
            {linked.map((group, index) => (
              <View key={group.id} style={styles.rankRow}>
                <Text style={styles.position}>#{index + 1}</Text>
                <Text style={styles.groupName}>{group.name}</Text>
              </View>
            ))}
          </Card>
        );
      })}
      {!competitions.length && (
        <Card>
          <Text style={styles.meta}>Crie uma competição vinculando duas ou mais ligas.</Text>
          <View style={styles.emptyAction}>
            <AppButton
              icon={<Swords color={colors.black} size={18} />}
              onPress={() => setName("")}
              title="Criar competição"
            />
          </View>
        </Card>
      )}
    </>
  );
};

const styles = StyleSheet.create({
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
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
    marginTop: spacing.sm
  },
  meta: {
    color: colors.muted,
    lineHeight: 20,
    marginTop: 4
  },
  rankRow: {
    alignItems: "center",
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingTop: spacing.sm
  },
  position: {
    color: colors.gold,
    fontWeight: "900",
    width: 42
  },
  groupName: {
    color: colors.text,
    flex: 1,
    fontWeight: "800"
  },
  emptyAction: {
    marginTop: spacing.md
  }
});
