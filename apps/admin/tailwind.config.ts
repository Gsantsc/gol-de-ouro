import type { Config } from "tailwindcss";
import { colorSystem } from "../../colors";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        pitch: {
          950: colorSystem.background,
          900: colorSystem.surface,
          800: colorSystem.card,
          700: colorSystem.surfaceRaised,
          600: colorSystem.borderSolid
        },
        gold: colorSystem.primary,
        "gold-hi": colorSystem.primaryHighlight,
        "gold-dark": colorSystem.primaryDark,
        grass: colorSystem.success,
        accent: colorSystem.accentBlue
      },
      boxShadow: {
        glow: "0 18px 44px rgba(212, 175, 55, 0.16)",
        panel: "0 1px 0 rgba(255,255,255,0.06), 0 18px 48px rgba(0,0,0,0.28)"
      }
    }
  },
  plugins: []
};

export default config;
