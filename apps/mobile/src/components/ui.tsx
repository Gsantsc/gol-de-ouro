import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { AlertCircle, CheckCircle2, Info, RefreshCw, Trophy } from "lucide-react-native";
import { colors, elevation, gradients, radius, spacing, statusColors, typography } from "../theme/tokens";

type Children = { children: ReactNode };
type Tone = "default" | "green" | "gold" | "red" | "blue" | "amber";
type ToastTone = "success" | "error" | "warning" | "info";

export const AppViewport = ({
  children,
  footer,
  toast
}: Children & { footer?: ReactNode; toast?: ReactNode }) => (
  <LinearGradient colors={gradients.app} style={styles.root}>
    <View pointerEvents="none" style={styles.lightTop} />
    <View pointerEvents="none" style={styles.lightBottom} />
    <View style={styles.viewport}>
      <View style={styles.scene}>{children}</View>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
    {toast}
  </LinearGradient>
);

export const Screen = ({ children }: Children) => (
  <LinearGradient colors={gradients.app} style={styles.root}>
    <View pointerEvents="none" style={styles.lightTop} />
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <View style={styles.container}>{children}</View>
    </ScrollView>
  </LinearGradient>
);

export const ScreenScroll = ({ children }: Children) => (
  <ScrollView
    contentContainerStyle={styles.screenContent}
    keyboardShouldPersistTaps="handled"
    showsVerticalScrollIndicator={false}
  >
    {children}
  </ScrollView>
);

export const Card = ({
  children,
  style,
  variant = "default"
}: Children & { style?: StyleProp<ViewStyle>; variant?: "default" | "soft" | "accent" | "hero" }) => (
  <View style={[styles.card, variant === "soft" && styles.cardSoft, variant === "accent" && styles.cardAccent, style]}>
    {variant === "hero" ? (
      <LinearGradient colors={gradients.hero} style={styles.cardHero}>
        {children}
      </LinearGradient>
    ) : (
      children
    )}
  </View>
);

export const Eyebrow = ({ children }: Children) => <Text style={styles.eyebrow}>{children}</Text>;

export const Title = ({ children }: Children) => <Text style={styles.title}>{children}</Text>;

export const Subtitle = ({ children }: Children) => <Text style={styles.subtitle}>{children}</Text>;

export const SectionTitle = ({ title, action }: { title: string; action?: ReactNode }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {action}
  </View>
);

export const Pill = ({ children, tone = "default" }: Children & { tone?: Tone }) => {
  const toneStyles = {
    default: styles.pill_default,
    green: styles.pill_green,
    gold: styles.pill_gold,
    red: styles.pill_red,
    blue: styles.pill_blue,
    amber: styles.pill_amber
  };

  return (
    <View style={[styles.pill, toneStyles[tone]]}>
      <Text
        style={[
          styles.pillText,
          tone === "green" && styles.pillTextGreen,
          tone === "gold" && styles.pillTextGold,
          tone === "red" && styles.pillTextRed,
          tone === "blue" && styles.pillTextBlue,
          tone === "amber" && styles.pillTextAmber
        ]}
      >
        {children}
      </Text>
    </View>
  );
};

export const StatusBadge = ({
  label,
  status
}: {
  label: string;
  status: keyof typeof statusColors;
}) => {
  const statusStyle = statusColors[status];

  return (
    <View
      style={[
        styles.statusBadge,
        { backgroundColor: statusStyle.background, borderColor: statusStyle.border }
      ]}
    >
      <Text style={[styles.statusBadgeText, { color: statusStyle.text }]}>{label}</Text>
    </View>
  );
};

export const AppButton = ({
  title,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  icon,
  compact = false
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "surface";
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  compact?: boolean;
}) => (
  <Pressable
    accessibilityRole="button"
    disabled={disabled || loading}
    onPress={onPress}
    style={({ pressed }) => [
      styles.button,
      compact && styles.buttonCompact,
      styles[`button_${variant}`],
      pressed && !disabled && styles.buttonPressed,
      disabled && styles.buttonDisabled
    ]}
  >
    {loading ? <ActivityIndicator color={variant === "ghost" || variant === "surface" ? colors.gold : colors.black} /> : icon}
    {title ? (
      <Text
        style={[
          styles.buttonText,
          (variant === "ghost" || variant === "surface") && styles.buttonTextGhost
        ]}
      >
        {title}
      </Text>
    ) : null}
  </Pressable>
);

export const IconButton = ({
  children,
  onPress,
  disabled = false,
  label
}: Children & { onPress: () => void; disabled?: boolean; label: string }) => (
  <Pressable
    accessibilityLabel={label}
    accessibilityRole="button"
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => [styles.iconButton, pressed && styles.buttonPressed, disabled && styles.buttonDisabled]}
  >
    {children}
  </Pressable>
);

export const Field = ({
  label,
  value,
  onChangeText,
  secureTextEntry = false,
  keyboardType = "default",
  placeholder
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "email-address" | "number-pad";
  placeholder?: string;
}) => (
  <View style={styles.fieldWrap}>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      autoCapitalize={keyboardType === "email-address" ? "none" : "sentences"}
      keyboardType={keyboardType}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.placeholder}
      secureTextEntry={secureTextEntry}
      style={styles.input}
      value={value}
    />
  </View>
);

export const MetricTile = ({
  icon,
  label,
  value,
  tone = "green"
}: {
  icon?: ReactNode;
  label: string;
  value: number | string;
  tone?: Exclude<Tone, "default">;
}) => {
  const toneColor = tone === "gold" ? colors.gold : tone === "red" ? colors.red : tone === "blue" ? colors.blue : colors.green;

  return (
    <View style={styles.metricTile}>
      <View style={styles.metricTop}>
        {icon}
        <Text style={[styles.metricValue, { color: toneColor }]}>{value}</Text>
      </View>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
};

export const EmptyState = ({
  title,
  body,
  actionLabel,
  onAction,
  icon
}: {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: ReactNode;
}) => (
  <Card variant="soft">
    <View style={styles.emptyIcon}>{icon ?? <Trophy color={colors.gold} size={22} />}</View>
    <Text style={styles.emptyTitle}>{title}</Text>
    <Text style={styles.emptyBody}>{body}</Text>
    {actionLabel && onAction ? (
      <View style={styles.emptyAction}>
        <AppButton compact onPress={onAction} title={actionLabel} />
      </View>
    ) : null}
  </Card>
);

export const ErrorState = ({
  title = "Algo saiu do eixo",
  body,
  onRetry
}: {
  title?: string;
  body: string;
  onRetry?: () => void;
}) => (
  <Card variant="soft">
    <View style={styles.errorIcon}>
      <AlertCircle color={colors.red} size={22} />
    </View>
    <Text style={styles.emptyTitle}>{title}</Text>
    <Text style={styles.emptyBody}>{body}</Text>
    {onRetry ? (
      <View style={styles.emptyAction}>
        <AppButton
          compact
          icon={<RefreshCw color={colors.black} size={16} />}
          onPress={onRetry}
          title="Tentar de novo"
        />
      </View>
    ) : null}
  </Card>
);

export const ToastBanner = ({
  floating = true,
  message,
  tone = "info"
}: {
  floating?: boolean;
  message: string;
  tone?: ToastTone;
}) => {
  const config = {
    success: { icon: <CheckCircle2 color={colors.green} size={18} />, style: styles.toastSuccess },
    error: { icon: <AlertCircle color={colors.red} size={18} />, style: styles.toastError },
    warning: { icon: <AlertCircle color={colors.gold} size={18} />, style: styles.toastWarning },
    info: { icon: <Info color={colors.blue} size={18} />, style: styles.toastInfo }
  }[tone];

  return (
    <View pointerEvents="none" style={[styles.toast, floating ? styles.toastFloating : styles.toastInline, config.style]}>
      {config.icon}
      <Text style={styles.toastText}>{message}</Text>
    </View>
  );
};

export const Skeleton = ({
  count = 3,
  height = 60
}: {
  count?: number;
  height?: number;
}) => (
  <>
    {Array.from({ length: count }).map((_, index) => (
      <View key={index} style={[styles.skeleton, { height }]} />
    ))}
  </>
);

export const LoadingState = ({ label = "Carregando" }: { label?: string }) => (
  <Card variant="soft">
    <View style={styles.loadingState}>
      <ActivityIndicator color={colors.gold} />
      <Text style={styles.loadingText}>{label}</Text>
    </View>
  </Card>
);

export const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: "hidden"
  },
  lightTop: {
    backgroundColor: colors.goldWash,
    height: 2,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0
  },
  lightBottom: {
    backgroundColor: colors.blueWash,
    bottom: 0,
    height: 2,
    left: 0,
    position: "absolute",
    right: 0
  },
  viewport: {
    alignSelf: "center",
    flex: 1,
    maxWidth: 980,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    width: "100%"
  },
  scene: {
    flex: 1
  },
  footer: {
    paddingBottom: spacing.sm,
    paddingTop: spacing.sm
  },
  screen: {
    flexGrow: 1,
    padding: spacing.md
  },
  screenContent: {
    gap: spacing.lg,
    paddingBottom: 152
  },
  container: {
    alignSelf: "center",
    gap: spacing.md,
    maxWidth: 980,
    width: "100%"
  },
  card: {
    backgroundColor: colors.surfaceGlass,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    ...elevation.card
  },
  cardSoft: {
    backgroundColor: colors.surfaceMuted
  },
  cardAccent: {
    backgroundColor: colors.goldSoft,
    borderColor: colors.borderStrong
  },
  cardHero: {
    borderRadius: radius.lg,
    margin: -spacing.md,
    overflow: "hidden",
    padding: spacing.md
  },
  eyebrow: {
    color: colors.gold,
    fontSize: typography.small,
    fontWeight: "900",
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  title: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 35
  },
  subtitle: {
    color: colors.muted,
    fontSize: typography.body,
    lineHeight: 22
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
    marginTop: spacing.xs
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: "900"
  },
  pill: {
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 4
  },
  pill_default: {
    backgroundColor: colors.whiteSoft,
    borderColor: colors.border
  },
  pill_green: {
    backgroundColor: colors.greenSoft,
    borderColor: colors.greenBorder
  },
  pill_gold: {
    backgroundColor: colors.goldSoft,
    borderColor: colors.borderGoldStrong
  },
  pill_red: {
    backgroundColor: colors.redSoft,
    borderColor: colors.redBorder
  },
  pill_blue: {
    backgroundColor: colors.blueSoft,
    borderColor: colors.blueBorder
  },
  pill_amber: {
    backgroundColor: colors.amberSoft,
    borderColor: colors.amberBorder
  },
  pillText: {
    color: colors.mutedStrong,
    fontSize: typography.tiny,
    fontWeight: "900"
  },
  pillTextGreen: {
    color: colors.green
  },
  pillTextGold: {
    color: colors.gold
  },
  pillTextRed: {
    color: colors.red
  },
  pillTextBlue: {
    color: colors.blue
  },
  pillTextAmber: {
    color: colors.amber
  },
  statusBadge: {
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  statusBadgeText: {
    fontSize: typography.tiny,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  button: {
    alignItems: "center",
    borderRadius: radius.md,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  buttonCompact: {
    minHeight: 36,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  button_primary: {
    backgroundColor: colors.gold,
    shadowColor: colors.goldDark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 14
  },
  button_secondary: {
    backgroundColor: colors.goldHighlight
  },
  button_ghost: {
    backgroundColor: "transparent",
    borderColor: colors.borderStrong,
    borderWidth: 1
  },
  button_surface: {
    backgroundColor: colors.surfaceGlass,
    borderColor: colors.border,
    borderWidth: 1
  },
  button_danger: {
    backgroundColor: colors.red
  },
  buttonPressed: {
    opacity: 0.78,
    transform: [{ translateY: 1 }]
  },
  buttonDisabled: {
    opacity: 0.48
  },
  buttonText: {
    color: colors.black,
    fontSize: 14,
    fontWeight: "900"
  },
  buttonTextGhost: {
    color: colors.text
  },
  iconButton: {
    alignItems: "center",
    backgroundColor: "rgba(18, 24, 38, 0.9)",
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40
  },
  fieldWrap: {
    gap: 7
  },
  label: {
    color: colors.mutedStrong,
    fontSize: 13,
    fontWeight: "800"
  },
  input: {
    backgroundColor: colors.surfaceDeep,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: spacing.md
  },
  metricTile: {
    backgroundColor: colors.whiteSoft,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    flexBasis: 132,
    minWidth: 132,
    padding: spacing.sm
  },
  metricTop: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
    justifyContent: "space-between"
  },
  metricValue: {
    color: colors.green,
    fontSize: 22,
    fontWeight: "900"
  },
  metricLabel: {
    color: colors.muted,
    fontSize: typography.tiny,
    fontWeight: "800",
    marginTop: 4
  },
  emptyIcon: {
    marginBottom: spacing.sm
  },
  errorIcon: {
    marginBottom: spacing.sm
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900"
  },
  emptyBody: {
    color: colors.muted,
    lineHeight: 21,
    marginTop: 6
  },
  emptyAction: {
    marginTop: spacing.md
  },
  toast: {
    alignItems: "center",
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  toastFloating: {
    alignSelf: "center",
    bottom: spacing.xl,
    left: spacing.md,
    maxWidth: 620,
    position: "absolute",
    right: spacing.md,
    zIndex: 20
  },
  toastInline: {
    alignSelf: "stretch"
  },
  toastSuccess: {
    backgroundColor: colors.greenSoft,
    borderColor: colors.greenBorder
  },
  toastError: {
    backgroundColor: "rgba(248, 113, 113, 0.14)",
    borderColor: colors.redBorder
  },
  toastWarning: {
    backgroundColor: "rgba(246, 196, 83, 0.14)",
    borderColor: colors.borderGoldStrong
  },
  toastInfo: {
    backgroundColor: colors.blueSoft,
    borderColor: colors.blueBorder
  },
  toastText: {
    color: colors.text,
    flex: 1,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18
  },
  skeleton: {
    backgroundColor: colors.whiteWash,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
    overflow: "hidden"
  },
  loadingState: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm
  },
  loadingText: {
    color: colors.mutedStrong,
    fontSize: 13,
    fontWeight: "800"
  }
});
