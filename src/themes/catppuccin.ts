import type { Theme } from "./contract";

/**
 * Catppuccin - uno dei nove temi regalati da Nikita Rodionov
 * (SPEC-temi-regalati.md, 5 settembre 2026).
 *
 * Font: dm-sans (UI) + cormorant-garamond (prosa), prosa a 22px.
 *
 * Provenienza. Catppuccin, MIT, Copyright (c) 2021 Catppuccin
 * (github.com/catppuccin/palette).
 * Set chiaro: gusto Latte, dallo stesso palette.json.
 *
 * Correzioni applicate (SPEC-temi-regalati cap. 2):
 *   - scuro inkFaint #8087A2 -> #989EB4 (3.46 -> 4.62 su surface)
 */
export const catppuccin: Theme = {
  id: "catppuccin",
  name: "Catppuccin",
  author: "Nikita Rodionov",
  typography: {
    fontUi: "dm-sans",
    fontProse: "cormorant-garamond",
    sizes: {
      display: 40,
      chapter: 28,
      pageHeader: 24,
      headline: 26,
      title: 21,
      prose: 22,
      body: 14,
      meta: 12,
      label: 11,
      metric: 32
    },
    weights: {
      headline: 600,
      prose: 500,
      label: 650,
      metric: 300
    },
    tracking: {
      headline: "-0.022em",
      label: "0.16em"
    },
    lineHeight: {
      display: 1.1,
      editorial: 1.2,
      prose: 1.6,
      body: 1.45
    }
  },
  shape: {
    radius: {
      sm: 8,
      md: 12,
      lg: 16,
      xl: 18,
      pill: 99,
      circle: "50%"
    },
    borderWidth: {
      hairline: 1,
      strong: 2
    }
  },
  space: 1,
  motion: {
    press: 0.94
  },
  light: {
    bg: "#DCE0E8",
    bgApp: "#EFF1F5",
    surface: "#FFFFFF",
    surface2: "#E6E9EF",
    ink: "#4C4F69",
    inkMuted: "#5C5F77",
    inkFaint: "#6C6F85",
    accent: "#8839EF",
    accentHi: "#A043FF",
    accentPressed: "#7531CE",
    onAccent: "#FFFFFF",
    success: "#40A02B",
    danger: "#D20F39",
    line: "rgba(76, 79, 105, 0.10)",
    shadow: "#4C4F69",
    glow: "transparent",
    warmth: "radial-gradient(100% 60% at 18% -12%, rgba(136, 57, 239, 0.045), transparent 68%)",
    grain: 0
  },
  dark: {
    bg: "#1E2030",
    bgApp: "#24273A",
    surface: "#303446",
    surface2: "#3E4459",
    ink: "#CAD3F5",
    inkMuted: "#B8C0E0",
    inkFaint: "#989EB4",
    accent: "#C6A0F6",
    accentHi: "#DEB3FF",
    accentPressed: "#AE8DD8",
    onAccent: "#1B0F2B",
    success: "#C6A0F6",
    danger: "#F0736A",
    line: "rgba(255, 255, 255, 0.07)",
    shadow: "#000000",
    glow: "#C6A0F6",
    warmth: "radial-gradient(100% 60% at 18% -12%, rgba(198, 160, 246, 0.06), transparent 68%)",
    grain: 0
  }
};
