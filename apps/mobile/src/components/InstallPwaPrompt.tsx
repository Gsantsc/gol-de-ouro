import { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Download, MonitorDown, Share, Smartphone, X } from "lucide-react-native";
import { AppButton, Card, Pill } from "./ui";
import { colors, radius, spacing } from "../theme/tokens";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const DISMISS_KEY = "gol-de-ouro-pwa-install-dismissed";

const getNavigator = () => {
  if (typeof navigator === "undefined") return null;
  return navigator;
};

const isStandalone = () => {
  if (Platform.OS !== "web" || typeof window === "undefined") return true;
  const mediaStandalone = window.matchMedia?.("(display-mode: standalone)").matches;
  const navigatorStandalone = Boolean((getNavigator() as Navigator & { standalone?: boolean } | null)?.standalone);
  return Boolean(mediaStandalone || navigatorStandalone);
};

const isIosSafari = () => {
  const nav = getNavigator();
  if (!nav) return false;
  const userAgent = nav.userAgent.toLowerCase();
  const isIos = /iphone|ipad|ipod/.test(userAgent);
  const isSafari = /safari/.test(userAgent) && !/crios|fxios|edgios/.test(userAgent);
  return isIos && isSafari;
};

const getDeviceCopy = () => {
  if (Platform.OS !== "web") return null;

  if (isIosSafari()) {
    return {
      icon: <Share color={colors.gold} size={18} />,
      label: "iPhone",
      title: "Instale na Tela de Inicio",
      body: "Abra o menu Compartilhar do Safari e toque em Adicionar a Tela de Inicio."
    };
  }

  const nav = getNavigator();
  const isMobile = Boolean(nav?.userAgent.toLowerCase().match(/android|iphone|ipad|ipod/));

  return {
    icon: isMobile ? <Smartphone color={colors.gold} size={18} /> : <MonitorDown color={colors.gold} size={18} />,
    label: isMobile ? "Mobile" : "Desktop",
    title: isMobile ? "Instale o Gol de Ouro" : "Use como aplicativo",
    body: isMobile
      ? "Acesse o app pela tela inicial, com experiencia de aplicativo e sem Play Store."
      : "Instale no Chrome ou Edge para abrir em janela dedicada."
  };
};

export const InstallPwaPrompt = () => {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [installed, setInstalled] = useState(false);
  const copy = useMemo(getDeviceCopy, []);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    const storedDismiss = window.localStorage.getItem(DISMISS_KEY);
    setDismissed(storedDismiss === "1");
    setInstalled(isStandalone());

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setDismissed(false);
    };

    const handleInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  if (Platform.OS !== "web" || installed || dismissed || !copy) return null;
  if (!installEvent && !isIosSafari()) return null;

  const dismiss = () => {
    if (typeof window !== "undefined") window.localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setInstallEvent(null);
  };

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <Card style={styles.card}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            {copy.icon}
            <Pill tone="gold">{copy.label}</Pill>
          </View>
          <Pressable accessibilityLabel="Fechar instalacao do app" accessibilityRole="button" onPress={dismiss} style={styles.close}>
            <X color={colors.mutedStrong} size={16} />
          </Pressable>
        </View>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.body}>{copy.body}</Text>
        {installEvent ? (
          <AppButton
            compact
            icon={<Download color={colors.black} size={16} />}
            onPress={install}
            title="Instalar app"
          />
        ) : (
          <View style={styles.iosHint}>
            <Text style={styles.step}>1. Toque em Compartilhar</Text>
            <Text style={styles.step}>2. Adicionar a Tela de Inicio</Text>
          </View>
        )}
      </Card>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    bottom: 90,
    left: spacing.md,
    maxWidth: 420,
    position: "absolute",
    right: spacing.md,
    zIndex: 20
  },
  card: {
    gap: spacing.xs,
    shadowOpacity: 0.34
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs
  },
  close: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    height: 32,
    justifyContent: "center",
    width: 32
  },
  title: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900"
  },
  body: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19
  },
  iosHint: {
    backgroundColor: colors.whiteSoft,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    gap: 4,
    padding: spacing.sm
  },
  step: {
    color: colors.mutedStrong,
    fontSize: 12,
    fontWeight: "800"
  }
});
