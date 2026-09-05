import type { Theme } from "./contract";

/**
 * Ocean - uno dei nove temi regalati da Nikita Rodionov
 * (SPEC-temi-regalati.md, 5 settembre 2026).
 *
 * Font: dm-sans (UI) + spectral (prosa), prosa a 19px.
 *
 * Provenienza. Tema proprio dell autore.
 * Il set chiaro non esisteva: disegnato in questa sessione, tenendo il fondo
 * profondo.
 *
 * Correzioni applicate (SPEC-temi-regalati cap. 2):
 *   - scuro inkFaint #7C8AA5 -> #7F8DA7 (4.45 -> 4.62 su surface)
 */
export const ocean: Theme = {
  id: "ocean",
  name: "Ocean",
  author: "Nikita Rodionov",
  typography: {
    fontUi: "dm-sans",
    fontProse: "spectral",
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
    bg: "#DCE5EF",
    bgApp: "#EFF4F9",
    surface: "#FFFFFF",
    surface2: "#E6EDF5",
    ink: "#0F172A",
    inkMuted: "#3C4A61",
    inkFaint: "#5E6D84",
    accent: "#0369A1",
    accentHi: "#047CBE",
    accentPressed: "#035A8A",
    onAccent: "#FFFFFF",
    success: "#166534",
    danger: "#B3261E",
    line: "rgba(15, 23, 42, 0.10)",
    shadow: "#182543",
    glow: "transparent",
    warmth: "radial-gradient(100% 60% at 18% -12%, rgba(3, 105, 161, 0.045), transparent 68%)",
    grain: 0
  },
  dark: {
    bg: "#0B1220",
    bgApp: "#0F172A",
    surface: "#1B2438",
    surface2: "#273349",
    ink: "#E2E8F0",
    inkMuted: "#C0CADB",
    inkFaint: "#7F8DA7",
    accent: "#38BDF8",
    accentHi: "#3FD4FF",
    accentPressed: "#31A6DA",
    onAccent: "#04202E",
    success: "#38BDF8",
    danger: "#F0736A",
    line: "rgba(255, 255, 255, 0.07)",
    shadow: "#000000",
    glow: "#38BDF8",
    warmth: "radial-gradient(100% 60% at 18% -12%, rgba(56, 189, 248, 0.06), transparent 68%)",
    grain: 0
  }
};
