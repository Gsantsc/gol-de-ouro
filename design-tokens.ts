import { colorSystem } from "./colors";
import { layout, spacing } from "./spacing";
import { typography } from "./typography";

export const designTokens = {
  color: colorSystem,
  spacing,
  layout,
  radius: {
    xs: 6,
    sm: 8,
    md: 8,
    lg: 12,
    xl: 16,
    pill: 999
  },
  shadow: {
    panel: "0 1px 0 rgba(255,255,255,0.06), 0 18px 48px rgba(0,0,0,0.28)",
    glow: "0 18px 44px rgba(212,175,55,0.16)"
  },
  typography,
  motion: {
    fast: 140,
    normal: 220,
    slow: 360,
    spring: {
      damping: 15,
      stiffness: 180
    }
  }
} as const;

export type DesignTokens = typeof designTokens;
