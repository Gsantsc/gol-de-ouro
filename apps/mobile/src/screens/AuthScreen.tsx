import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LogIn, UserPlus } from "lucide-react-native";
import { readAuthError } from "../shared";
import { useAuth } from "../hooks/useAuth";
import { colors, spacing } from "../theme/tokens";
import { BrandLogo } from "../components/BrandLogo";
import { AppButton, Card, Eyebrow, Field, Screen, Subtitle, Title, ToastBanner } from "../components/ui";

type Mode = "login" | "signup";

export const AuthScreen = () => {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<"success" | "error" | "info">("info");

  const submit = async () => {
    if (loading) return;

    try {
      setLoading(true);
      setFeedback(null);
      if (mode === "login") {
        await signIn(email, password);
        setFeedback("Login efetuado com sucesso.\nRedirecionando...");
        setFeedbackTone("success");
      } else {
        await signUp(name, email, password);
        setFeedback("Cadastro realizado com sucesso.\nAgora aguarde a aprovação do administrador.");
        setFeedbackTone("success");
      }
    } catch (error) {
      const message = readAuthError(error);
      setFeedback(message);
      setFeedbackTone("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      {feedback ? <ToastBanner message={feedback} tone={feedbackTone} /> : null}
      <View style={styles.hero}>
        <BrandLogo size="md" />
        <Eyebrow>Bolão premium</Eyebrow>
        <Title>Seu bolão premium de futebol.</Title>
        <Subtitle>
          Palpites travados, ranking em tempo real e aprovação manual para manter o grupo fechado.
        </Subtitle>
      </View>

      <Card>
        <View style={styles.switcher}>
          <AppButton
            title="Entrar"
            onPress={() => setMode("login")}
            variant={mode === "login" ? "primary" : "ghost"}
            icon={<LogIn color={mode === "login" ? colors.black : colors.text} size={18} />}
          />
          <AppButton
            title="Cadastrar"
            onPress={() => setMode("signup")}
            variant={mode === "signup" ? "primary" : "ghost"}
            icon={<UserPlus color={mode === "signup" ? colors.black : colors.text} size={18} />}
          />
        </View>

        <View style={styles.form}>
          {mode === "signup" && (
            <Field label="Nome" value={name} onChangeText={setName} placeholder="Seu nome" />
          )}
          <Field
            keyboardType="email-address"
            label="Email"
            onChangeText={setEmail}
            placeholder="voce@email.com"
            value={email}
          />
          <Field
            label="Senha"
            onChangeText={setPassword}
            placeholder="******"
            secureTextEntry
            value={password}
          />

          <AppButton
            loading={loading}
            onPress={submit}
            title={mode === "login" ? "Acessar" : "Criar conta"}
          />
          {feedback && <Text style={styles.feedback}>{feedback}</Text>}
        </View>

        {mode === "signup" && (
          <Text style={styles.note}>
            Todo cadastro novo entra como pending e só acessa o app depois da aprovação.
          </Text>
        )}
      </Card>
    </Screen>
  );
};

const styles = StyleSheet.create({
  hero: {
    gap: spacing.sm,
    paddingTop: spacing.xl
  },
  switcher: {
    flexDirection: "row",
    gap: spacing.sm
  },
  form: {
    gap: spacing.md,
    marginTop: spacing.md
  },
  feedback: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19
  },
  note: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.md
  }
});
