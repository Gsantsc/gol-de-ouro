import { designTokens } from "./design-tokens";

export const golDeOuroTheme = {
  name: "gol-de-ouro-premium",
  tokens: designTokens,
  app: {
    backgroundGradient: [
      designTokens.color.background,
      designTokens.color.surface,
      designTokens.color.background
    ],
    surfaceGlass: "rgba(24,33,49,0.88)",
    goldGlass: "rgba(212,175,55,0.10)",
    focusRing: "0 0 0 3px rgba(212,175,55,0.24)"
  }
} as const;
