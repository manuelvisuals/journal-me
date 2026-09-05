import type { Theme } from "./contract";

/**
 * Gruvbox - uno dei nove temi regalati da Nikita Rodionov
 * (SPEC-temi-regalati.md, 5 settembre 2026).
 *
 * Font: ibm-plex-mono (UI) + eb-garamond (prosa), prosa a 21px.
 *
 * Provenienza. Gruvbox, MIT/X11, dichiarata nel README
 * (github.com/morhetz/gruvbox).
 * Set chiaro: light0/light1/light2, dark0-dark3 e i colori faded_*, dallo
 * stesso colors/gruvbox.vim.
 *
 * Correzioni applicate (SPEC-temi-regalati cap. 2):
 *   - scuro inkFaint #A08F73 -> #B0A28B (3.68 -> 4.63 su surface)
 */
export const gruvbox: Theme = {
  id: "gruvbox",
  name: "Gruvbox",
  author: "Nikita Rodionov",
  typography: {
    fontUi: "ibm-plex-mono",
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
    bg: "#EBDBB2",
    bgApp: "#FBF1C7",
    surface: "#F9F5D7",
    surface2: "#EBDBB2",
    ink: "#282828",
    inkMuted: "#504945",
    inkFaint: "#665C54",
    accent: "#AF3A03",
    accentHi: "#CE4404",
    accentPressed: "#963203",
    onAccent: "#FBF1C7",
    success: "#427B58",
    danger: "#9D0006",
    line: "rgba(40, 40, 40, 0.10)",
    shadow: "#404040",
    glow: "transparent",
    warmth: "radial-gradient(100% 60% at 18% -12%, rgba(175, 58, 3, 0.045), transparent 68%)",
    grain: 0
  },
  dark: {
    bg: "#1F1F1F",
    bgApp: "#282828",
    surface: "#3C3836",
    surface2: "#504945",
    ink: "#FBF1C7",
    inkMuted: "#D5C4A1",
    inkFaint: "#B0A28B",
    accent: "#FE8019",
    accentHi: "#FF8F1C",
    accentPressed: "#E07116",
    onAccent: "#2A1403",
    success: "#FE8019",
    danger: "#F0736A",
    line: "rgba(255, 255, 255, 0.07)",
    shadow: "#000000",
    glow: "#FE8019",
    warmth: "radial-gradient(100% 60% at 18% -12%, rgba(254, 128, 25, 0.06), transparent 68%)",
    grain: 0
  }
};
