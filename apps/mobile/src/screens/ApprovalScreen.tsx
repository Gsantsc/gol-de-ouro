import { StyleSheet, Text, View } from "react-native";
import { Clock3, ShieldX } from "lucide-react-native";
import { useAuth } from "../hooks/useAuth";
import { colors, spacing } from "../theme/tokens";
import { AppButton, Card, Screen, Subtitle, Title } from "../components/ui";

export const ApprovalScreen = () => {
  const { profile, signOut } = useAuth();
  const status = profile?.status ?? (profile?.blocked ? "suspended" : profile?.approval_status);
  const rejected = status === "rejected";
  const suspended = status === "suspended" || profile?.blocked;
  const message = suspended
    ? "Seu acesso foi suspenso."
    : rejected
      ? profile?.rejection_reason || "Seu cadastro foi rejeitado pelo administrador."
      : "Seu cadastro está em análise.";

  return (
    <Screen>
      <Card>
        <View style={styles.iconWrap}>
          {rejected || suspended ? (
            <ShieldX color={colors.red} size={42} />
          ) : (
            <Clock3 color={colors.gold} size={42} />
          )}
        </View>
        <Title>
          {suspended
            ? "Acesso suspenso"
            : rejected
              ? "Cadastro rejeitado"
              : "Aguardando aprovação do administrador"}
        </Title>
        <Subtitle>{message}</Subtitle>
        <Text style={styles.body}>
          Assim que o status virar approved, o app libera campeonatos, palpites e ranking automaticamente.
        </Text>
        <AppButton title="Sair" onPress={signOut} variant="ghost" />
      </Card>
    </Screen>
  );
};

const styles = StyleSheet.create({
  iconWrap: {
    marginBottom: spacing.md
  },
  body: {
    color: colors.muted,
    lineHeight: 22,
    marginBottom: spacing.lg,
    marginTop: spacing.md
  }
});
