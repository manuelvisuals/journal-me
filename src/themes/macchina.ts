import type { Theme } from "./contract";

/**
 * Macchina da scrivere — IBM Plex Mono, senza colore, angoli vivi.
 *
 * Non e un capriccio: e il caso limite che dimostra che il contratto tiene.
 * glow spento, grain 0, warmth none, raggi a 0, accent uguale a ink,
 * ombre spente (shadow trasparente). Se l'app regge questo, regge
 * qualunque tema.
 */
export const macchina: Theme = {
  id: "macchina",
  name: "Macchina da scrivere",
  typography: {
    fontUi: "ibm-plex-mono",
    fontProse: "ibm-plex-mono",
    sizes: {
      display: 30,
      chapter: 21,
      pageHeader: 18,
      headline: 19,
      title: 17,
      prose: 15,
      body: 13,
      meta: 11,
      label: 10,
      metric: 26,
    },
    weights: { headline: 500, prose: 400, label: 600, metric: 400 },
    tracking: { headline: "0em", label: "0.10em" },
    lineHeight: { display: 1.15, editorial: 1.3, prose: 1.7, body: 1.5 },
  },
  shape: {
    radius: { sm: 0, md: 0, lg: 0, xl: 0, pill: 0, circle: "0px" },
    borderWidth: { hairline: 1, strong: 2 },
  },
  space: 0.88,
  motion: { press: 1 },
  dark: {
    bg: "#0A0A0A",
    bgApp: "#0F0F0F",
    surface: "#161616",
    surface2: "#1C1C1C",
    ink: "#EDEDED",
    inkMuted: "#B0B0B0",
    inkFaint: "#828282",
    accent: "#EDEDED",
    accentPressed: "#C9C9C9",
    accentHi: "#FFFFFF",
    onAccent: "#0A0A0A",
    success: "#EDEDED",
    danger: "#EDEDED",
    line: "rgba(237, 237, 237, 0.16)",
    shadow: "transparent",
    glow: "transparent",
    warmth: "none",
    grain: 0,
  },
  light: {
    bg: "#EDEDED",
    bgApp: "#FAFAFA",
    surface: "#FFFFFF",
    surface2: "#F0F0F0",
    ink: "#111111",
    inkMuted: "#3D3D3D",
    inkFaint: "#5F5F5F",
    accent: "#111111",
    accentPressed: "#000000",
    accentHi: "#000000",
    onAccent: "#FAFAFA",
    success: "#111111",
    danger: "#111111",
    line: "rgba(17, 17, 17, 0.18)",
    shadow: "transparent",
    glow: "transparent",
    warmth: "none",
    grain: 0,
  },
};
