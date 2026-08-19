/**
 * L'elenco curato delle famiglie (SPEC-temi.md §7).
 *
 * Un tema non porta un font da internet: sceglie un id da questo elenco.
 * I woff2 sono committati in src/fonts/ e dichiarati STATICAMENTE in
 * src/app/layout.tsx via next/font/local — ognuno espone una CSS variable.
 * Il tema si limita a scegliere QUALE variable mettere in --jm-font-sans /
 * --jm-font-serif; non si carica mai un font in base al tema a runtime
 * (finirebbe in un flash di testo non stilizzato a ogni cambio).
 */

export type FontId =
  | "inter"
  | "newsreader"
  | "spectral"
  | "eb-garamond"
  | "dm-sans"
  | "cormorant-garamond"
  | "ibm-plex-mono";

type FontDef = {
  /** Nome leggibile, per il picker. */
  name: string;
  /** Stack completo: la variable di next/font/local piu i fallback. */
  stack: string;
};

export const FONTS: Record<FontId, FontDef> = {
  inter: {
    name: "Inter",
    stack:
      'var(--font-inter), system-ui, -apple-system, "SF Pro Display", "SF Pro Text", "Helvetica Neue", sans-serif',
  },
  newsreader: {
    name: "Newsreader",
    stack: 'var(--font-newsreader), Georgia, "Times New Roman", serif',
  },
  spectral: {
    name: "Spectral",
    stack: 'var(--font-spectral), Georgia, "Times New Roman", serif',
  },
  "eb-garamond": {
    name: "EB Garamond",
    stack: 'var(--font-eb-garamond), Georgia, "Times New Roman", serif',
  },
  "dm-sans": {
    name: "DM Sans",
    stack: "var(--font-dm-sans), system-ui, -apple-system, sans-serif",
  },
  "cormorant-garamond": {
    name: "Cormorant Garamond",
    stack: 'var(--font-cormorant-garamond), Georgia, "Times New Roman", serif',
  },
  "ibm-plex-mono": {
    name: "IBM Plex Mono",
    stack: 'var(--font-ibm-plex-mono), ui-monospace, "SF Mono", Menlo, monospace',
  },
};
