import type { Theme } from "./contract";

/**
 * Korall - uno dei nove temi regalati da Nikita Rodionov
 * (SPEC-temi-regalati.md, 5 settembre 2026).
 *
 * Font: dm-sans (UI) + eb-garamond (prosa), prosa a 21px.
 *
 * Provenienza. Tema proprio dell autore.
 * Il set chiaro non esisteva: disegnato in questa sessione, tenendo il fondo
 * caldo come dice la sua intenzione.
 *
 * Correzioni applicate (SPEC-temi-regalati cap. 2):
 *   - scuro inkFaint #8F8286 -> #94878B (4.30 -> 4.60 su surface)
 */
export const korall: Theme = {
  id: "korall",
  name: "Korall",
  author: "Nikita Rodionov",
  typography: {
    fontUi: "dm-sans",
    fontProse: "eb-garamond",
    sizes: {
      display: 40,
      chapter: 28,
      pageHeader: 24,
      headline: 26,
      title: 21,
      prose: 21,
      body: 14,
      meta: 12,
      label: 11,
      metric: 32
    },
    weights: {
      headline: 600,
      prose: 400,
      label: 650,
      metric: 300
    },
    tracking: {
      headline: "-0.022em",
      label: "0.06em"
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
    bg: "#EEE3E1",
    bgApp: "#FBF5F4",
    surface: "#FFFFFF",
    surface2: "#F3E9E7",
    ink: "#241D1F",
    inkMuted: "#54464A",
    inkFaint: "#7A6569",
    accent: "#B0574F",
    accentHi: "#D0675D",
    accentPressed: "#974B44",
    onAccent: "#FFFFFF",
    success: "#3F7355",
    danger: "#A83A3A",
    line: "rgba(36, 29, 31, 0.10)",
    shadow: "#3A2E32",
    glow: "transparent",
    warmth: "radial-gradient(100% 60% at 18% -12%, rgba(176, 87, 79, 0.045), transparent 68%)",
    grain: 0
  },
  dark: {
    bg: "#171416",
    bgApp: "#1E1B1D",
    surface: "#262124",
    surface2: "#332C30",
    ink: "#F6EFEF",
    inkMuted: "#CBBFC1",
    inkFaint: "#94878B",
    accent: "#FF8A8A",
    accentHi: "#FF9B9B",
    accentPressed: "#E07979",
    onAccent: "#2B1214",
    success: "#FF8A8A",
    danger: "#F0736A",
    line: "rgba(255, 255, 255, 0.07)",
    shadow: "#000000",
    glow: "#FF8A8A",
    warmth: "radial-gradient(100% 60% at 18% -12%, rgba(255, 138, 138, 0.06), transparent 68%)",
    grain: 0
  }
};
