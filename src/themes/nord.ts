import type { Theme } from "./contract";

/**
 * Nord - uno dei nove temi regalati da Nikita Rodionov
 * (SPEC-temi-regalati.md, 5 settembre 2026).
 *
 * Font: dm-sans (UI) + newsreader (prosa), prosa a 19px.
 *
 * Provenienza. Nord, MIT, Copyright (c) 2016-present Sven Greb
 * (github.com/nordtheme/nord).
 * Set chiaro: gruppi Snow Storm (nord4-nord6) e Polar Night (nord0-nord3), gia
 * dentro la palette ufficiale.
 *
 * Correzioni applicate (SPEC-temi-regalati cap. 2):
 *   - scuro inkFaint #95A0B3 -> #A7B0C0 (3.81 -> 4.61 su surface)
 *   - chiaro accent #5E81AC -> #5477A3 (4.03 -> 4.62 col testo del bottone)
 */
export const nord: Theme = {
  id: "nord",
  name: "Nord",
  author: "Nikita Rodionov",
  typography: {
    fontUi: "dm-sans",
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
    bg: "#D8DEE9",
    bgApp: "#ECEFF4",
    surface: "#FFFFFF",
    surface2: "#E5E9F0",
    ink: "#2E3440",
    inkMuted: "#434C5E",
    inkFaint: "#4C566A",
    accent: "#5477A3",
    accentHi: "#638CC0",
    accentPressed: "#48668C",
    onAccent: "#FFFFFF",
    success: "#4A6E4F",
    danger: "#A5454E",
    line: "rgba(46, 52, 64, 0.10)",
    shadow: "#4A5366",
    glow: "transparent",
    warmth: "radial-gradient(100% 60% at 18% -12%, rgba(84, 119, 163, 0.045), transparent 68%)",
    grain: 0
  },
  dark: {
    bg: "#272C36",
    bgApp: "#2E3440",
    surface: "#3B4252",
    surface2: "#434C5E",
    ink: "#ECEFF4",
    inkMuted: "#D8DEE9",
    inkFaint: "#A7B0C0",
    accent: "#88C0D0",
    accentHi: "#98D7E9",
    accentPressed: "#78A9B7",
    onAccent: "#12222A",
    success: "#88C0D0",
    danger: "#F0736A",
    line: "rgba(255, 255, 255, 0.07)",
    shadow: "#000000",
    glow: "#88C0D0",
    warmth: "radial-gradient(100% 60% at 18% -12%, rgba(136, 192, 208, 0.06), transparent 68%)",
    grain: 0
  }
};
