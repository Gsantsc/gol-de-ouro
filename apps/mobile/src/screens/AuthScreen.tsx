import { useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { KeyRound, LogIn, UserPlus } from "lucide-react-native";
import { readAuthError } from "../shared";
import { useAuth } from "../hooks/useAuth";
import { colors, spacing } from "../theme/tokens";
import { BrandLogo } from "../components/BrandLogo";
import { AppButton, Card, Eyebrow, Field, Screen, Subtitle, Title, ToastBanner } from "../components/ui";

type Mode = "login" | "signup" | "forgot";

const PASSWORD_RESET_GENERIC_MESSAGE =
  "Se o e-mail estiver cadastrado, enviaremos um link para redefinir sua senha.";

export const AuthScreen = () => {
  const { requestPasswordReset, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<"success" | "error" | "info">("info");
  const submittingRef = useRef(false);

  const changeMode = (nextMode: Mode) => {
    if (loading) return;
    setMode(nextMode);
    setFeedback(null);
  };

  const submit = async () => {
    if (submittingRef.current) return;

    try {
      submittingRef.current = true;
      setLoading(true);
      setFeedback(null);
      if (mode === "login") {
        await signIn(email, password);
        setFeedback("Login efetuado com sucesso.\nRedirecionando...");
        setFeedbackTone("success");
      } else if (mode === "signup") {
        await signUp(name, email, password);
        setFeedback("Cadastro realizado com sucesso.\nAgora aguarde a aprovação do administrador.");
        setFeedbackTone("success");
      } else {
        await requestPasswordReset(email);
        setFeedback(PASSWORD_RESET_GENERIC_MESSAGE);
        setFeedbackTone("success");
      }
    } catch (error) {
      if (mode === "forgot") {
        setFeedback(PASSWORD_RESET_GENERIC_MESSAGE);
        setFeedbackTone("success");
        return;
      }
      const message = readAuthError(error);
      setFeedback(message);
      setFeedbackTone("error");
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  return (
    <Screen>
      <View style={styles.hero}>
        <BrandLogo size="md" />
        <Eyebrow>Bolão premium</Eyebrow>
        <Title>Seu bolão premium de futebol.</Title>
        <Subtitle>
          Palpites travados, ranking em tempo real e aprovação manual para manter o grupo fechado.
        </Subtitle>
      </View>

      {feedback ? <ToastBanner floating={false} message={feedback} tone={feedbackTone} /> : null}

      <Card>
        <View style={styles.switcher}>
          <AppButton
            disabled={loading}
            title="Entrar"
            onPress={() => changeMode("login")}
            variant={mode === "login" ? "primary" : "ghost"}
            icon={<LogIn color={mode === "login" ? colors.black : colors.text} size={18} />}
          />
          <AppButton
            disabled={loading}
            title="Cadastrar"
            onPress={() => changeMode("signup")}
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
          {mode !== "forgot" ? (
            <Field
              label="Senha"
              onChangeText={setPassword}
              placeholder="******"
              secureTextEntry
              value={password}
            />
          ) : (
            <Text style={styles.note}>
              Informe seu email para receber o link de recuperação de senha.
            </Text>
          )}

          {mode === "login" && (
            <AppButton
              disabled={loading}
              icon={<KeyRound color={colors.text} size={18} />}
              onPress={() => changeMode("forgot")}
              title="Esqueci minha senha"
              variant="ghost"
            />
          )}

          <AppButton
            disabled={!email || (mode !== "forgot" && !password) || (mode === "signup" && !name)}
            loading={loading}
            onPress={submit}
            title={mode === "forgot" ? "Enviar link de recuperação" : mode === "login" ? "Acessar" : "Criar conta"}
          />
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
  note: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.md
  }
});
