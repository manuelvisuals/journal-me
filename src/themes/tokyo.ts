import type { Theme } from "./contract";

/**
 * Tokyo Night - uno dei nove temi regalati da Nikita Rodionov
 * (SPEC-temi-regalati.md, 5 settembre 2026).
 *
 * Font: ibm-plex-mono (UI) + newsreader (prosa), prosa a 19px.
 *
 * Provenienza. Tokyo Night, Apache License 2.0
 * (github.com/folke/tokyonight.nvim).
 * Set chiaro: Tokyo Night Day, stesso repository e stessa licenza
 * (extras/lua/tokyonight_day.lua). Apache 2.0 chiede di conservare l avviso di
 * licenza e di segnalare le modifiche.
 *
 * Correzioni applicate (SPEC-temi-regalati cap. 2):
 *   - scuro inkFaint #7A82AB -> #888FB4 (3.89 -> 4.60 su surface)
 *   - chiaro accent #2E7DE9 -> #1A71E7 (4.02 -> 4.61 col testo del bottone)
 */
export const tokyo: Theme = {
  id: "tokyo",
  name: "Tokyo Night",
  author: "Nikita Rodionov",
  typography: {
    fontUi: "ibm-plex-mono",
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
      label: "0.10em"
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
    bg: "#D0D5E3",
    bgApp: "#E1E2E7",
    surface: "#FFFFFF",
    surface2: "#D8DCEA",
    ink: "#3760BF",
    inkMuted: "#4A5A9E",
    inkFaint: "#68709A",
    accent: "#1A71E7",
    accentHi: "#1F85FF",
    accentPressed: "#1661C7",
    onAccent: "#FFFFFF",
    success: "#587539",
    danger: "#C64343",
    line: "rgba(55, 96, 191, 0.10)",
    shadow: "#3760BF",
    glow: "transparent",
    warmth: "radial-gradient(100% 60% at 18% -12%, rgba(26, 113, 231, 0.045), transparent 68%)",
    grain: 0
  },
  dark: {
    bg: "#16161E",
    bgApp: "#1A1B26",
    surface: "#24283B",
    surface2: "#2F3549",
    ink: "#C0CAF5",
    inkMuted: "#A9B1D6",
    inkFaint: "#888FB4",
    accent: "#7AA2F7",
    accentHi: "#89B5FF",
    accentPressed: "#6B8FD9",
    onAccent: "#0B1220",
    success: "#7AA2F7",
    danger: "#F0736A",
    line: "rgba(255, 255, 255, 0.07)",
    shadow: "#000000",
    glow: "#7AA2F7",
    warmth: "radial-gradient(100% 60% at 18% -12%, rgba(122, 162, 247, 0.06), transparent 68%)",
    grain: 0
  }
};
