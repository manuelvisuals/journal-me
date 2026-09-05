import type { Theme } from "./contract";

/**
 * Ametista - uno dei nove temi regalati da Nikita Rodionov
 * (SPEC-temi-regalati.md, 5 settembre 2026).
 *
 * Font: inter (UI) + eb-garamond (prosa), prosa a 21px.
 *
 * Provenienza. Palette scura: Dracula, MIT, Copyright (c) 2023 Dracula Theme
 * (github.com/dracula/dracula-theme).
 * Set chiaro: i valori di Alucard, il tema chiaro ufficiale di Dracula, che fa
 * parte di Dracula PRO (prodotto a pagamento); ripresi da
 * github.com/jaljoue/dracula-alucard.nvim, repository privo di file di
 * licenza. NON e materiale libero. Decisione di Manuel del 5 settembre 2026:
 * tenerli e rinominare il tema, che da qui in avanti si chiama Ametista e non
 * porta ne il nome Dracula ne il nome Alucard.
 *
 * Nota. Rinominato. Vedi la riga sulla provenienza: il nome e cambiato per non
 * usare marchi altrui, NON per nascondere da dove vengono i valori chiari.
 *
 * Correzioni applicate (SPEC-temi-regalati cap. 2):
 *   - scuro inkFaint #8E91A8 -> #9FA1B5 (3.80 -> 4.63 su surface)
 */
export const ametista: Theme = {
  id: "ametista",
  name: "Ametista",
  author: "Nikita Rodionov",
  typography: {
    fontUi: "inter",
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
    bg: "#F5F1E3",
    bgApp: "#FFFBEB",
    surface: "#FFFFFF",
    surface2: "#F5F1E3",
    ink: "#1F1F1F",
    inkMuted: "#4A4A4A",
    inkFaint: "#6C664B",
    accent: "#644AC9",
    accentHi: "#7657ED",
    accentPressed: "#5640AD",
    onAccent: "#FFFFFF",
    success: "#14710A",
    danger: "#CB3A2A",
    line: "rgba(31, 31, 31, 0.10)",
    shadow: "#323232",
    glow: "transparent",
    warmth: "radial-gradient(100% 60% at 18% -12%, rgba(100, 74, 201, 0.045), transparent 68%)",
    grain: 0
  },
  dark: {
    bg: "#21222C",
    bgApp: "#282A36",
    surface: "#343746",
    surface2: "#414458",
    ink: "#F8F8F2",
    inkMuted: "#C4C6D4",
    inkFaint: "#9FA1B5",
    accent: "#BD93F9",
    accentHi: "#D4A5FF",
    accentPressed: "#A681DB",
    onAccent: "#17102A",
    success: "#BD93F9",
    danger: "#F0736A",
    line: "rgba(255, 255, 255, 0.07)",
    shadow: "#000000",
    glow: "#BD93F9",
    warmth: "radial-gradient(100% 60% at 18% -12%, rgba(189, 147, 249, 0.06), transparent 68%)",
    grain: 0
  }
};
