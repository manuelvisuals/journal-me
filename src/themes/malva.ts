import type { Theme } from "./contract";

/**
 * Malva — femminile per sottrazione. DM Sans + Cormorant Garamond.
 *
 * Niente rosa saturo: greige caldo e prugna smorzata (Aesop, Kinfolk).
 * Il lavoro lo fa la tipografia: Cormorant va usato da 21px in su e a peso
 * 500, sotto sparisce. Se qualcuno in futuro "aggiusta" l'accent alzandone
 * la saturazione, il tema smette di funzionare (SPEC-temi §9).
 */
export const malva: Theme = {
  id: "malva",
  name: "Malva",
  typography: {
    fontUi: "dm-sans",
    fontProse: "cormorant-garamond",
    sizes: {
      display: 46,
      chapter: 30,
      pageHeader: 24,
      headline: 27,
      title: 23,
      prose: 22,
      body: 14,
      meta: 12,
      label: 11,
      metric: 32,
    },
    weights: { headline: 500, prose: 500, label: 650, metric: 300 },
    tracking: { headline: "-0.012em", label: "0.16em" },
    lineHeight: { display: 1.08, editorial: 1.2, prose: 1.6, body: 1.45 },
  },
  shape: {
    radius: { sm: 12, md: 16, lg: 22, xl: 26, pill: 999, circle: "50%" },
    borderWidth: { hairline: 1, strong: 2 },
  },
  space: 1.06,
  motion: { press: 0.97 },
  light: {
    bg: "#E9E2E1",
    bgApp: "#FAF6F5",
    surface: "#FFFFFF",
    surface2: "#F4EEEE",
    ink: "#2A2226",
    inkMuted: "#5A4A52",
    inkFaint: "#7B6670",
    accent: "#8A4A64",
    accentPressed: "#743D53",
    accentHi: "#A05C78",
    onAccent: "#FFFFFF",
    success: "#4F7A5E",
    danger: "#A83E3E",
    line: "rgba(42, 34, 38, 0.10)",
    shadow: "#785F69",
    glow: "transparent",
    warmth:
      "radial-gradient(circle at 26% -8%, rgba(138, 74, 100, 0.05), transparent 44%)",
    grain: 0.018,
  },
  dark: {
    bg: "#131013",
    bgApp: "#1B161A",
    surface: "#241E23",
    surface2: "#2D262C",
    ink: "#F0E7EA",
    inkMuted: "#C9B6BE",
    inkFaint: "#9E8C94",
    accent: "#D9A3B4",
    accentPressed: "#C08D9E",
    accentHi: "#EAB9C8",
    onAccent: "#241118",
    success: "#9CC7A9",
    danger: "#E88A8A",
    line: "rgba(240, 231, 234, 0.10)",
    shadow: "#000000",
    glow: "transparent",
    warmth:
      "radial-gradient(circle at 26% -8%, rgba(217, 163, 180, 0.05), transparent 44%)",
    grain: 0.018,
  },
};
