import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LogIn, RefreshCw, ShieldCheck, Trophy, Users } from "lucide-react-native";
import type { GroupInviteAcceptResult, GroupInvitePreview } from "../shared";
import { readError } from "../shared";
import { BrandLogo } from "../components/BrandLogo";
import { AppButton, Card, MetricTile, Screen, Skeleton, Subtitle, Title, ToastBanner } from "../components/ui";
import { getGroupInvitePreview } from "../services/football.service";
import { colors, spacing } from "../theme/tokens";

type InviteAccessStatus = "signed_out" | "pending" | "approved" | "rejected" | "suspended";

export const InviteScreen = ({
  accepting,
  accessStatus,
  inviteCode,
  onAccept,
  onRequireAuth,
  onVerifyApproval,
  refreshingProfile
}: {
  accepting?: boolean;
  accessStatus: InviteAccessStatus;
  inviteCode: string;
  onAccept: () => Promise<GroupInviteAcceptResult | null>;
  onRequireAuth: () => void;
  onVerifyApproval?: () => Promise<void>;
  refreshingProfile?: boolean;
}) => {
  const [preview, setPreview] = useState<GroupInvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ message: string; tone: "success" | "error" | "info" } | null>(null);

  useEffect(() => {
    let mounted = true;

    setLoading(true);
    setFeedback(null);
    getGroupInvitePreview(inviteCode)
      .then((nextPreview) => {
        if (mounted) setPreview(nextPreview);
      })
      .catch((error) => {
        if (mounted) setFeedback({ message: readError(error), tone: "error" });
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [inviteCode]);

  const handleAccept = async () => {
    if (accessStatus === "signed_out") {
      onRequireAuth();
      return;
    }

    try {
      setFeedback(null);
      const result = await onAccept();
      if (result?.status === "pending_approval") {
        setFeedback({
          message: "Convite salvo. Assim que o admin aprovar seu cadastro, voce entra nesta liga.",
          tone: "info"
        });
        return;
      }
      if (result?.status === "already_member") {
        setFeedback({ message: "Voce ja participa desta liga. Redirecionando...", tone: "success" });
        return;
      }
      setFeedback({ message: "Convite aceito. Redirecionando para a liga...", tone: "success" });
    } catch (error) {
      setFeedback({ message: readError(error), tone: "error" });
    }
  };

  const verifyApproval = async () => {
    if (!onVerifyApproval) return;

    try {
      setFeedback(null);
      await onVerifyApproval();
      setFeedback({ message: "Status verificado. Se ja foi aprovado, vamos liberar sua entrada.", tone: "info" });
    } catch (error) {
      setFeedback({ message: readError(error), tone: "error" });
    }
  };

  const blocked = accessStatus === "rejected" || accessStatus === "suspended";
  const primaryTitle =
    accessStatus === "signed_out"
      ? "Entrar ou cadastrar para participar"
      : accessStatus === "pending"
        ? "Salvar convite"
        : "Entrar na liga";

  return (
    <Screen>
      <View style={styles.hero}>
        <BrandLogo size="md" />
        <Text style={styles.eyebrow}>Convite exclusivo</Text>
      </View>

      {feedback ? <ToastBanner floating={false} message={feedback.message} tone={feedback.tone} /> : null}

      {loading ? (
        <Card>
          <Skeleton count={3} height={74} />
        </Card>
      ) : preview ? (
        <Card>
          <View style={styles.iconWrap}>
            <ShieldCheck color={colors.gold} size={34} />
          </View>
          <Title>Voce foi convidado para a liga {preview.group_name}</Title>
          <Subtitle>
            Confira os detalhes e entre com a sua conta para participar somente desta liga.
          </Subtitle>

          <View style={styles.metrics}>
            <MetricTile
              icon={<Trophy color={colors.gold} size={18} />}
              label="campeonato"
              tone="gold"
              value={preview.championship_name}
            />
            <MetricTile
              icon={<Users color={colors.green} size={18} />}
              label="participantes"
              value={preview.participant_count}
            />
          </View>

          {accessStatus === "pending" ? (
            <Text style={styles.pendingText}>
              Seu cadastro ainda aguarda aprovacao. Vamos guardar este convite sem tentar login de novo.
            </Text>
          ) : null}

          {blocked ? (
            <Text style={styles.blockedText}>
              Esta conta nao pode entrar em ligas no momento. Entre em contato com o administrador.
            </Text>
          ) : (
            <AppButton
              disabled={accepting}
              icon={
                accessStatus === "signed_out" ? (
                  <LogIn color={colors.black} size={18} />
                ) : (
                  <ShieldCheck color={colors.black} size={18} />
                )
              }
              loading={accepting}
              onPress={handleAccept}
              title={primaryTitle}
            />
          )}

          {accessStatus === "pending" && onVerifyApproval ? (
            <AppButton
              disabled={accepting}
              icon={<RefreshCw color={colors.text} size={18} />}
              loading={refreshingProfile}
              onPress={verifyApproval}
              title="Verificar aprovacao"
              variant="ghost"
            />
          ) : null}
        </Card>
      ) : (
        <Card>
          <Title>Convite indisponivel</Title>
          <Subtitle>Este link pode ter expirado, sido revogado ou estar incorreto.</Subtitle>
        </Card>
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  hero: {
    gap: spacing.sm,
    paddingTop: spacing.xl
  },
  eyebrow: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  iconWrap: {
    marginBottom: spacing.sm
  },
  metrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginVertical: spacing.lg
  },
  pendingText: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19,
    marginBottom: spacing.md
  },
  blockedText: {
    color: colors.red,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19,
    marginTop: spacing.md
  }
});
