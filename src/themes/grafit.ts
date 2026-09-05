import type { Theme } from "./contract";

/**
 * Grafit - uno dei nove temi regalati da Nikita Rodionov
 * (SPEC-temi-regalati.md, 5 settembre 2026).
 *
 * Font: inter (UI) + newsreader (prosa), prosa a 19px.
 *
 * Provenienza. Tema proprio dell autore.
 * Il set chiaro non esisteva: disegnato in questa sessione, fondo neutro e un
 * solo accento vivo.
 *
 * Correzioni applicate (SPEC-temi-regalati cap. 2):
 *   - scuro inkFaint #7A828F -> #8D949F (3.67 -> 4.65 su surface)
 */
export const grafit: Theme = {
  id: "grafit",
  name: "Grafit",
  author: "Nikita Rodionov",
  typography: {
    fontUi: "inter",
    fontProse: "newsreader",
    sizes: {
      display: 40,
      chapter: 28,
      pageHeader: 24,
      headline: 26,
      title: 21,
      prose: 19,
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
    bg: "#E4E7EB",
    bgApp: "#F4F5F7",
    surface: "#FFFFFF",
    surface2: "#EBEDF1",
    ink: "#1C1F26",
    inkMuted: "#454B55",
    inkFaint: "#666D78",
    accent: "#0E7C6B",
    accentHi: "#11927E",
    accentPressed: "#0C6B5C",
    onAccent: "#FFFFFF",
    success: "#0E7C6B",
    danger: "#B3352F",
    line: "rgba(28, 31, 38, 0.10)",
    shadow: "#2D323D",
    glow: "transparent",
    warmth: "radial-gradient(100% 60% at 18% -12%, rgba(14, 124, 107, 0.045), transparent 68%)",
    grain: 0
  },
  dark: {
    bg: "#171A20",
    bgApp: "#1C1F26",
    surface: "#262B34",
    surface2: "#2E343E",
    ink: "#E8EAED",
    inkMuted: "#BFC0CC",
    inkFaint: "#8D949F",
    accent: "#2DE1C2",
    accentHi: "#32FCD9",
    accentPressed: "#28C6AB",
    onAccent: "#10221F",
    success: "#2DE1C2",
    danger: "#F0736A",
    line: "rgba(255, 255, 255, 0.07)",
    shadow: "#000000",
    glow: "#2DE1C2",
    warmth: "radial-gradient(100% 60% at 18% -12%, rgba(45, 225, 194, 0.06), transparent 68%)",
    grain: 0
  }
};
