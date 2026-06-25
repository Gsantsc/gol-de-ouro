export const colors = {
  background: "#070B13",
  backgroundAlt: "#0D1321",
  surface: "#111827",
  surfaceAlt: "#172033",
  surfaceSoft: "#202B3D",
  surfaceGlass: "rgba(20, 29, 45, 0.92)",
  surfaceMuted: "rgba(17, 24, 39, 0.8)",
  surfaceDeep: "rgba(7, 11, 19, 0.76)",
  card: "#172033",
  border: "rgba(255,255,255,0.1)",
  borderStrong: "rgba(246,211,101,0.3)",
  borderGold: "rgba(246, 211, 101, 0.18)",
  borderGoldStrong: "rgba(246, 211, 101, 0.38)",
  text: "#F8FAFC",
  muted: "#94A3B8",
  mutedStrong: "#CBD5E1",
  subtle: "#64748B",
  placeholder: "rgba(148,163,184,0.58)",
  whiteSoft: "rgba(248,250,252,0.045)",
  whiteWash: "rgba(248,250,252,0.09)",
  green: "#22C55E",
  greenDark: "#16A34A",
  greenSoft: "rgba(34, 197, 94, 0.12)",
  greenBorder: "rgba(34, 197, 94, 0.42)",
  gold: "#D4AF37",
  goldHighlight: "#F6D365",
  goldDark: "#A98224",
  goldSoft: "rgba(212, 175, 55, 0.16)",
  goldWash: "rgba(246, 211, 101, 0.08)",
  red: "#EF4444",
  redSoft: "rgba(239, 68, 68, 0.13)",
  redBorder: "rgba(248, 113, 113, 0.42)",
  amber: "#F59E0B",
  amberSoft: "rgba(245, 158, 11, 0.13)",
  amberBorder: "rgba(245, 158, 11, 0.38)",
  blue: "#2563EB",
  blueSoft: "rgba(37, 99, 235, 0.16)",
  blueBorder: "rgba(96, 165, 250, 0.42)",
  blueWash: "rgba(37, 99, 235, 0.1)",
  silver: "#D6DEE4",
  bronze: "#C98748",
  black: "#05070D",
  shadow: "rgba(0,0,0,0.38)"
};

export const gradients = {
  app: [colors.background, colors.backgroundAlt, colors.background] as const,
  hero: ["rgba(246, 211, 101, 0.2)", "rgba(20, 29, 45, 0.96)", "rgba(7, 11, 19, 0.92)"] as const,
  gold: [colors.goldHighlight, colors.gold] as const
};

export const statusColors = {
  aberto: { background: colors.greenSoft, border: colors.greenBorder, text: colors.green },
  fechado: { background: colors.goldSoft, border: colors.borderGoldStrong, text: colors.gold },
  ao_vivo: { background: colors.redSoft, border: colors.redBorder, text: colors.red },
  encerrado: { background: colors.whiteSoft, border: colors.border, text: colors.mutedStrong },
  aprovado: { background: colors.greenSoft, border: colors.greenBorder, text: colors.green },
  pendente: { background: colors.amberSoft, border: colors.amberBorder, text: colors.amber },
  rejeitado: { background: colors.redSoft, border: colors.redBorder, text: colors.red },
  suspenso: { background: colors.whiteSoft, border: colors.border, text: colors.mutedStrong }
};

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 28,
  xxl: 40
};

export const radius = {
  xs: 6,
  sm: 8,
  md: 8,
  lg: 12,
  xl: 16,
  pill: 999
};

export const typography = {
  title: 32,
  heading: 22,
  body: 15,
  small: 12,
  tiny: 11
};

export const elevation = {
  card: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.26,
    shadowRadius: 24
  },
  lifted: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.34,
    shadowRadius: 32
  }
};
