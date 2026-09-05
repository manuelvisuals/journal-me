import type { Theme } from "./contract";

/**
 * Korall ardesia - uno dei nove temi regalati da Nikita Rodionov
 * (SPEC-temi-regalati.md, 5 settembre 2026).
 *
 * Font: inter (UI) + spectral (prosa), prosa a 18px.
 *
 * Provenienza. Tema proprio dell autore.
 * Il set chiaro non esisteva: disegnato in questa sessione, tenendo il fondo
 * freddo come dice la sua intenzione.
 *
 * Nota. Rinominato il 5 settembre 2026, scelta di Manuel. L autore lo definiva
 * come Vampire con l accento ammorbidito, ma Vampire non entra in dayalogue e
 * due temi non possono chiamarsi Korall. "Ardesia" dice la cosa che davvero lo
 * distingue dall altro Korall: il fondo grigio-azzurro freddo contro il fondo
 * bruno caldo. Non si e usato "Korall scuro" perche in dayalogue "chiaro" e
 * "scuro" sono i due modi di ogni tema, e un tema chiamato "scuro" acceso in
 * modo chiaro e una contraddizione a schermo.
 *
 * Correzioni applicate (SPEC-temi-regalati cap. 2):
 *   - scuro inkFaint #8B8DA0 -> #9092A4 (4.35 -> 4.63 su surface)
 */
export const ardesia: Theme = {
  id: "ardesia",
  name: "Korall ardesia",
  author: "Nikita Rodionov",
  typography: {
    fontUi: "inter",
    fontProse: "spectral",
    sizes: {
      display: 40,
      chapter: 28,
      pageHeader: 24,
      headline: 26,
      title: 21,
      prose: 18,
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
    bg: "#DEDFE8",
    bgApp: "#F1F1F6",
    surface: "#FFFFFF",
    surface2: "#E7E8F0",
    ink: "#21222C",
    inkMuted: "#4B4D5E",
    inkFaint: "#6C6F84",
    accent: "#B0574F",
    accentHi: "#D0675D",
    accentPressed: "#974B44",
    onAccent: "#FFFFFF",
    success: "#1F7A4C",
    danger: "#B3261E",
    line: "rgba(33, 34, 44, 0.10)",
    shadow: "#353646",
    glow: "transparent",
    warmth: "radial-gradient(100% 60% at 18% -12%, rgba(176, 87, 79, 0.045), transparent 68%)",
    grain: 0
  },
  dark: {
    bg: "#191A21",
    bgApp: "#21222C",
    surface: "#282A36",
    surface2: "#343746",
    ink: "#F8F8F2",
    inkMuted: "#BFC0CC",
    inkFaint: "#9092A4",
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
