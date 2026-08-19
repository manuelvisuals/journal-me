import type { Theme } from "./contract";

/**
 * Wine premium — il brandbook. Inter + Spectral.
 *
 * Il set `dark` e ESTRATTO dai valori che l'app aveva prima dei temi
 * (globals.css a commit 6ef18fc): e la rete di sicurezza del passo 0.2
 * della PR 0 — con tema wine + scuro l'app deve essere identica a prima.
 * Unica differenza voluta: inkFaint da #8E7770 a #9A8279, perche il valore
 * storico dava 4,42:1 su surface, sotto la soglia AA (SPEC-temi §6).
 * warmth e grain vengono dall'app (body::before / body::after), non dal
 * mockup: sui valori gia in produzione vince il codice.
 */
export const wine: Theme = {
  id: "wine",
  name: "Wine premium",
  typography: {
    fontUi: "inter",
    fontProse: "spectral",
    sizes: {
      display: 40,
      chapter: 28,
      pageHeader: 24,
      headline: 26,
      title: 22,
      prose: 18,
      body: 14,
      meta: 12,
      label: 11,
      metric: 32,
    },
    weights: { headline: 650, prose: 400, label: 650, metric: 300 },
    tracking: { headline: "-0.018em", label: "0.22em" },
    lineHeight: { display: 1.1, editorial: 1.2, prose: 1.65, body: 1.45 },
  },
  shape: {
    radius: { sm: 10, md: 14, lg: 18, xl: 22, pill: 999, circle: "50%" },
    borderWidth: { hairline: 1, strong: 2 },
  },
  space: 1,
  motion: { press: 0.97 },
  dark: {
    bg: "#050304",
    bgApp: "#0E0709",
    surface: "#1D1013",
    surface2: "#241418",
    ink: "#F4E7DE",
    inkMuted: "#CDB7AE",
    inkFaint: "#9A8279",
    accent: "#E3A15F",
    accentPressed: "#D08F4D",
    accentHi: "#F0B875",
    onAccent: "#1A0E0F",
    success: "#A8C9B0",
    danger: "#F87171",
    line: "rgba(255, 229, 214, 0.075)",
    shadow: "#000000",
    glow: "#E3A15F",
    warmth:
      "radial-gradient(circle at 50% 0%, rgba(227, 161, 95, 0.06), transparent 35%), radial-gradient(circle at 12% 22%, rgba(126, 80, 80, 0.12), transparent 30%)",
    grain: 0.025,
  },
  light: {
    bg: "#F1E9E1",
    bgApp: "#FBF7F2",
    surface: "#FFFFFF",
    surface2: "#F4EBE2",
    ink: "#2B1A17",
    inkMuted: "#5E463E",
    inkFaint: "#82655A",
    accent: "#9A5A22",
    accentPressed: "#82491A",
    accentHi: "#B87031",
    onAccent: "#FFFDF9",
    success: "#4A7A56",
    danger: "#B33A3A",
    line: "rgba(43, 26, 23, 0.10)",
    shadow: "#5A3C2D",
    glow: "transparent",
    warmth:
      "radial-gradient(circle at 30% -6%, rgba(178, 106, 43, 0.05), transparent 40%)",
    grain: 0.025,
  },
};
