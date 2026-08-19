import type { Theme } from "./contract";

/**
 * Minimal — molto Apple. Inter + Newsreader.
 *
 * Il tema di DEFAULT (deciso il 17 agosto 2026): il caso d'uso centrale e
 * scrivere a lungo su un portatile, e Inter + Newsreader su fondo neutro e
 * la combinazione piu riposante per farlo. L'accent non e un colore: e il
 * nero (in chiaro) o il bianco (in scuro), come i bottoni di Apple.
 * E il caso limite "zero texture": accent monocromatico, chiaro bianco puro.
 */
export const minimal: Theme = {
  id: "minimal",
  name: "Minimal",
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
      metric: 32,
    },
    weights: { headline: 600, prose: 400, label: 650, metric: 300 },
    tracking: { headline: "-0.022em", label: "0.06em" },
    lineHeight: { display: 1.1, editorial: 1.2, prose: 1.6, body: 1.45 },
  },
  shape: {
    radius: { sm: 8, md: 12, lg: 16, xl: 20, pill: 999, circle: "50%" },
    borderWidth: { hairline: 1, strong: 2 },
  },
  space: 1,
  motion: { press: 0.97 },
  light: {
    bg: "#FFFFFF",
    bgApp: "#FFFFFF",
    surface: "#F5F5F7",
    surface2: "#EBEBEF",
    ink: "#1D1D1F",
    inkMuted: "#494950",
    inkFaint: "#6E6E73",
    accent: "#1D1D1F",
    accentPressed: "#000000",
    accentHi: "#000000",
    onAccent: "#FFFFFF",
    success: "#1D1D1F",
    danger: "#C0392B",
    line: "rgba(0, 0, 0, 0.10)",
    shadow: "#000000",
    glow: "transparent",
    warmth: "none",
    grain: 0,
  },
  dark: {
    bg: "#000000",
    bgApp: "#0B0B0C",
    surface: "#161618",
    surface2: "#1F1F22",
    ink: "#F5F5F7",
    inkMuted: "#B8B8BE",
    inkFaint: "#86868B",
    accent: "#F5F5F7",
    accentPressed: "#D8D8DE",
    accentHi: "#FFFFFF",
    onAccent: "#1D1D1F",
    success: "#F5F5F7",
    danger: "#FF6B60",
    line: "rgba(255, 255, 255, 0.12)",
    shadow: "#000000",
    glow: "transparent",
    warmth: "none",
    grain: 0,
  },
};
