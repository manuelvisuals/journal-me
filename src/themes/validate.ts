import type { ColorSet, Mode, Theme } from "./contract";

/**
 * Validazione del contrasto — non facoltativa (SPEC-temi §6).
 *
 * Prima che un tema sia selezionabile (incluso, importato o scaricato),
 * queste coppie devono passare SU TUTTI E DUE i set. Un tema che passa in
 * scuro e fallisce in chiaro non passa: sarebbe rotto per meta degli utenti.
 *
 * Un tema che non passa non viene rifiutato in silenzio: ogni Issue dice
 * quale coppia fallisce e di quanto. Se il tema e dell'utente resta usabile
 * con un avviso; dal marketplace non si pubblica.
 */

export type ContrastIssue = {
  mode: Mode;
  pair: string;
  ratio: number;
  required: number;
};

type Pair = {
  name: string;
  fg: keyof ColorSet;
  bg: keyof ColorSet;
  required: number;
};

/** Le coppie che l'app usa davvero. */
const PAIRS: Pair[] = [
  { name: "ink / bgApp", fg: "ink", bg: "bgApp", required: 4.5 },
  { name: "ink / surface", fg: "ink", bg: "surface", required: 4.5 },
  { name: "inkMuted / surface", fg: "inkMuted", bg: "surface", required: 4.5 },
  { name: "inkFaint / surface", fg: "inkFaint", bg: "surface", required: 4.5 },
  { name: "onAccent / accent", fg: "onAccent", bg: "accent", required: 4.5 },
  { name: "accent / bgApp", fg: "accent", bg: "bgApp", required: 3.0 },
];

export function validateTheme(theme: Theme): ContrastIssue[] {
  const issues: ContrastIssue[] = [];
  for (const mode of ["light", "dark"] as const) {
    const set = theme[mode];
    for (const p of PAIRS) {
      const fg = parseColor(set[p.fg] as string);
      const bg = parseColor(set[p.bg] as string);
      if (!fg || !bg) continue;
      const ratio = contrastRatio(fg, bg);
      if (ratio < p.required) {
        issues.push({ mode, pair: p.name, ratio, required: p.required });
      }
    }
  }
  return issues;
}

/* ---------------- WCAG ---------------- */

type Rgb = { r: number; g: number; b: number };

function parseColor(input: string): Rgb | null {
  const v = input.trim();
  const hex = v.match(/^#([0-9a-fA-F]{6})$/);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  const short = v.match(/^#([0-9a-fA-F]{3})$/);
  if (short) {
    const [r, g, b] = short[1].split("");
    return {
      r: parseInt(r + r, 16),
      g: parseInt(g + g, 16),
      b: parseInt(b + b, 16),
    };
  }
  const rgb = v.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if (rgb) {
    return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]) };
  }
  // transparent, gradient, ecc.: non misurabile qui.
  return null;
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function luminance(c: Rgb): number {
  return 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
