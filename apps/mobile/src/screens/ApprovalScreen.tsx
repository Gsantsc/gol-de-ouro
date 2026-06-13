import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Clock3, ShieldX } from "lucide-react-native";
import { useAuth } from "../hooks/useAuth";
import { readError } from "../shared";
import { colors, spacing } from "../theme/tokens";
import { AppButton, Card, Screen, Subtitle, Title } from "../components/ui";

export const ApprovalScreen = () => {
  const { profile, refreshProfile, refreshingProfile, signOut } = useAuth();
  const [feedback, setFeedback] = useState<string | null>(null);
  const status = profile?.status ?? (profile?.blocked ? "suspended" : profile?.approval_status);
  const rejected = status === "rejected";
  const suspended = status === "suspended" || profile?.blocked;
  const message = suspended
    ? "Seu acesso foi suspenso."
    : rejected
      ? profile?.rejection_reason || "Seu cadastro foi rejeitado pelo administrador."
      : "Seu cadastro esta em analise.";

  const verifyApproval = async () => {
    try {
      setFeedback(null);
      await refreshProfile();
      setFeedback("Status verificado. Se a aprovacao ja foi feita, o app sera liberado agora.");
    } catch (error) {
      setFeedback(readError(error));
    }
  };

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
              : "Aguardando aprovacao do administrador"}
        </Title>
        <Subtitle>{message}</Subtitle>
        <Text style={styles.body}>
          Depois que o administrador aprovar, toque em "Verificar aprovacao" ou entre novamente.
        </Text>
        {!rejected && !suspended && (
          <AppButton title="Verificar aprovacao" onPress={verifyApproval} loading={refreshingProfile} />
        )}
        {feedback && <Text style={styles.feedback}>{feedback}</Text>}
        <AppButton title="Sair" onPress={signOut} variant="ghost" disabled={refreshingProfile} />
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
  },
  feedback: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19,
    marginVertical: spacing.sm
  }
});
