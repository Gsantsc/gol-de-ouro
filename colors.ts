export const colorSystem = {
  background: "#0B0F19",
  surface: "#121826",
  card: "#182131",
  surfaceRaised: "#202B3D",
  borderSolid: "#263244",
  primary: "#D4AF37",
  primaryHighlight: "#F6D365",
  primaryDark: "#A98224",
  accentBlue: "#2563EB",
  textPrimary: "#F8FAFC",
  textSecondary: "#94A3B8",
  textMuted: "#64748B",
  border: "rgba(255,255,255,0.08)",
  borderStrong: "rgba(246,211,101,0.28)",
  success: "#22C55E",
  warning: "#F59E0B",
  error: "#EF4444"
} as const;

export type ColorToken = keyof typeof colorSystem;
