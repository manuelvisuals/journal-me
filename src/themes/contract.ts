/**
 * Il contratto dei token (SPEC-temi.md).
 *
 * Due assi indipendenti: il TEMA (font, scala tipografica, forme, densita,
 * texture) e l'APPEARANCE (chiaro / scuro / sistema). Un tema dichiara i
 * token condivisi una volta e DUE set di colori, uno per modo. Nessuna
 * derivazione automatica del chiaro dallo scuro.
 *
 * Chiavi sconosciute: ignorate. Chiavi mancanti: si eredita dal tema di
 * default (resolveTheme). Queste due proprieta insieme impediscono a un tema
 * scritto male di rompere l'app.
 */

import { FONTS, type FontId } from "./fonts";

export type Mode = "light" | "dark";
export type Appearance = Mode | "system";

export type Typography = {
  fontUi: FontId;
  fontProse: FontId;
  /** Ruoli, non misure (px). Se serve una taglia che non e un ruolo, il ruolo manca: si aggiunge qui, non si scrive un numero in un componente. */
  sizes: {
    display: number;
    chapter: number;
    pageHeader: number;
    headline: number;
    title: number;
    prose: number;
    body: number;
    meta: number;
    label: number;
    metric: number;
  };
  weights: {
    headline: number;
    prose: number;
    label: number;
    metric: number;
  };
  tracking: {
    /** Negativo, in em (es. "-0.018em"). */
    headline: string;
    /** Positivo, in em (es. "0.22em"). */
    label: string;
  };
  lineHeight: {
    display: number;
    editorial: number;
    prose: number;
    body: number;
  };
};

export type Shape = {
  radius: {
    sm: number;
    md: number;
    lg: number;
    xl: number;
    /** 999 per pillole; 0 nel tema macchina. */
    pill: number;
    /** "50%" per cerchi; "0px" nel tema macchina. */
    circle: string;
  };
  borderWidth: {
    hairline: number;
    strong: number;
  };
};

export type Motion = {
  /** Scala del feedback al tocco. 1 = niente. */
  press: number;
};

/**
 * I tredici colori piu i valori "fatti di colore" (line, shadow, glow,
 * warmth, grain), che per questo stanno nel set e non fra i condivisi:
 * un'ombra nera su fondo chiaro non e un'ombra, e un glow ambra su carta
 * bianca e sporco.
 *
 * Tutto il resto (fondi tinti, bordi accent, alette) si DERIVA con
 * `color-mix(in oklab, var(--jm-accent) N%, transparent)`: nessun altro
 * colore esiste.
 */
export type ColorSet = {
  bg: string;
  bgApp: string;
  surface: string;
  surface2: string;
  ink: string;
  inkMuted: string;
  inkFaint: string;
  accent: string;
  accentPressed: string;
  accentHi: string;
  /** Testo sopra l'accent: va dichiarato, non indovinato. */
  onAccent: string;
  success: string;
  danger: string;
  /** Hairline di separazione. */
  line: string;
  /** Colore base delle ombre (nero nei temi scuri, bruno nei chiari). */
  shadow: string;
  /** Colore degli aloni luminosi. "transparent" li spegne tutti. */
  glow: string;
  /** I radial-gradient di calore del fondo, o "none". */
  warmth: string;
  /** Opacita della grana. 0 = via. */
  grain: number;
};

export type Theme = {
  id: string;
  name: string;
  author?: string;
  typography: Typography;
  shape: Shape;
  /** Moltiplicatore della scala 8pt: padding, gap, margin. MAI le larghezze dei contenitori. */
  space: number;
  motion: Motion;
  light: ColorSet;
  dark: ColorSet;
};

export const DEFAULT_THEME_ID = "minimal";
export const DEFAULT_APPEARANCE: Appearance = "system";

/** Chiavi localStorage — le uniche che lo script di boot puo leggere in modo sincrono. */
export const THEME_STORAGE_KEY = "jm:theme";
export const APPEARANCE_STORAGE_KEY = "jm:appearance";

/* ------------------------------------------------------------------ */
/* CSS custom properties                                               */
/* ------------------------------------------------------------------ */

/**
 * Traduce (tema, modo) nella mappa di custom property che l'app consuma.
 * I nomi --jm-* sono il livello runtime: `@theme inline` in globals.css li
 * espone a Tailwind, e globals.css li usa via i nomi storici --color-*.
 */
export function cssVarsFor(theme: Theme, mode: Mode): Record<string, string> {
  const t = theme.typography;
  const s = theme.shape;
  const c = mode === "dark" ? theme.dark : theme.light;
  const px = (n: number) => `${n}px`;
  return {
    /* colore */
    "--jm-bg": c.bg,
    "--jm-bg-app": c.bgApp,
    "--jm-surface": c.surface,
    "--jm-surface-2": c.surface2,
    "--jm-ink": c.ink,
    "--jm-ink-muted": c.inkMuted,
    "--jm-ink-faint": c.inkFaint,
    "--jm-accent": c.accent,
    "--jm-accent-pressed": c.accentPressed,
    "--jm-accent-hi": c.accentHi,
    "--jm-on-accent": c.onAccent,
    "--jm-success": c.success,
    "--jm-danger": c.danger,
    "--jm-line": c.line,
    "--jm-shadow": c.shadow,
    "--jm-glow": c.glow,
    "--jm-warmth": c.warmth,
    "--jm-grain": String(c.grain),
    /* font: il tema sceglie QUALE variable di next/font/local usare */
    "--jm-font-sans": FONTS[t.fontUi].stack,
    "--jm-font-serif": FONTS[t.fontProse].stack,
    /* tipografia: ruoli */
    "--jm-text-display": px(t.sizes.display),
    "--jm-text-chapter": px(t.sizes.chapter),
    "--jm-text-page-header": px(t.sizes.pageHeader),
    "--jm-text-headline": px(t.sizes.headline),
    "--jm-text-title": px(t.sizes.title),
    "--jm-text-prose": px(t.sizes.prose),
    "--jm-text-body": px(t.sizes.body),
    "--jm-text-meta": px(t.sizes.meta),
    "--jm-text-label": px(t.sizes.label),
    "--jm-text-metric": px(t.sizes.metric),
    "--jm-weight-headline": String(t.weights.headline),
    "--jm-weight-prose": String(t.weights.prose),
    "--jm-weight-label": String(t.weights.label),
    "--jm-weight-metric": String(t.weights.metric),
    "--jm-tracking-headline": t.tracking.headline,
    "--jm-tracking-label": t.tracking.label,
    "--jm-leading-display": String(t.lineHeight.display),
    "--jm-leading-editorial": String(t.lineHeight.editorial),
    "--jm-leading-prose": String(t.lineHeight.prose),
    "--jm-leading-body": String(t.lineHeight.body),
    /* forma */
    "--jm-radius-sm": px(s.radius.sm),
    "--jm-radius-md": px(s.radius.md),
    "--jm-radius-lg": px(s.radius.lg),
    "--jm-radius-xl": px(s.radius.xl),
    "--jm-radius-pill": px(s.radius.pill),
    "--jm-radius-circle": s.radius.circle,
    "--jm-border-hairline": px(s.borderWidth.hairline),
    "--jm-border-strong": px(s.borderWidth.strong),
    /* densita e moto */
    "--jm-space": String(theme.space),
    "--jm-press": String(theme.motion.press),
  };
}

/* ------------------------------------------------------------------ */
/* resolveTheme: JSON parziale -> tema completo                        */
/* ------------------------------------------------------------------ */

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Fonde un tema parziale (JSON importato o scaricato) sul tema di default.
 * Le chiavi ignote vengono scartate; le mancanti ereditano. Un tema e DATI,
 * mai codice: qui non passa nessuna stringa che finisca in un <style> senza
 * essere un colore, un id di font dall'elenco, un numero entro range o un enum.
 */
export function resolveTheme(partial: unknown, base: Theme): Theme {
  if (!isRecord(partial)) return base;
  const merged: Theme = {
    ...base,
    id: typeof partial.id === "string" ? partial.id : base.id,
    name: typeof partial.name === "string" ? partial.name : base.name,
    author: typeof partial.author === "string" ? partial.author : base.author,
    space:
      typeof partial.space === "number" && partial.space >= 0.7 && partial.space <= 1.4
        ? partial.space
        : base.space,
    typography: mergeTypography(partial.typography, base.typography),
    shape: mergeShape(partial.shape, base.shape),
    motion: isRecord(partial.motion) &&
      typeof partial.motion.press === "number" &&
      partial.motion.press >= 0.9 &&
      partial.motion.press <= 1
      ? { press: partial.motion.press }
      : base.motion,
    light: mergeColorSet(partial.light, base.light),
    dark: mergeColorSet(partial.dark, base.dark),
  };
  return merged;
}

const COLOR_RE =
  /^(#[0-9a-fA-F]{3,8}|rgba?\([\d\s.,%/]+\)|hsla?\([\d\s.,%/deg]+\)|oklch\([\d\s.,%/]+\)|transparent)$/;
const WARMTH_RE = /^(none|radial-gradient\([^;{}<>]*\)(\s*,\s*radial-gradient\([^;{}<>]*\))*)$/;

function color(v: unknown, fallback: string): string {
  return typeof v === "string" && COLOR_RE.test(v.trim()) ? v.trim() : fallback;
}

function mergeColorSet(v: unknown, base: ColorSet): ColorSet {
  if (!isRecord(v)) return base;
  return {
    bg: color(v.bg, base.bg),
    bgApp: color(v.bgApp, base.bgApp),
    surface: color(v.surface, base.surface),
    surface2: color(v.surface2, base.surface2),
    ink: color(v.ink, base.ink),
    inkMuted: color(v.inkMuted, base.inkMuted),
    inkFaint: color(v.inkFaint, base.inkFaint),
    accent: color(v.accent, base.accent),
    accentPressed: color(v.accentPressed, base.accentPressed),
    accentHi: color(v.accentHi, base.accentHi),
    onAccent: color(v.onAccent, base.onAccent),
    success: color(v.success, base.success),
    danger: color(v.danger, base.danger),
    line: color(v.line, base.line),
    shadow: color(v.shadow, base.shadow),
    glow: color(v.glow, base.glow),
    warmth:
      typeof v.warmth === "string" && WARMTH_RE.test(v.warmth.trim())
        ? v.warmth.trim()
        : base.warmth,
    grain:
      typeof v.grain === "number" && v.grain >= 0 && v.grain <= 0.08
        ? v.grain
        : base.grain,
  };
}

function num(v: unknown, fallback: number, min: number, max: number): number {
  return typeof v === "number" && v >= min && v <= max ? v : fallback;
}

function mergeTypography(v: unknown, base: Typography): Typography {
  if (!isRecord(v)) return base;
  const fontId = (x: unknown, fb: FontId): FontId =>
    typeof x === "string" && x in FONTS ? (x as FontId) : fb;
  const sizes = isRecord(v.sizes) ? v.sizes : {};
  const weights = isRecord(v.weights) ? v.weights : {};
  const tracking = isRecord(v.tracking) ? v.tracking : {};
  const lineHeight = isRecord(v.lineHeight) ? v.lineHeight : {};
  const em = (x: unknown, fb: string) =>
    typeof x === "string" && /^-?\d*(\.\d+)?em$/.test(x.trim()) ? x.trim() : fb;
  return {
    fontUi: fontId(v.fontUi, base.fontUi),
    fontProse: fontId(v.fontProse, base.fontProse),
    sizes: {
      display: num(sizes.display, base.sizes.display, 24, 64),
      chapter: num(sizes.chapter, base.sizes.chapter, 18, 44),
      pageHeader: num(sizes.pageHeader, base.sizes.pageHeader, 16, 36),
      headline: num(sizes.headline, base.sizes.headline, 15, 36),
      title: num(sizes.title, base.sizes.title, 14, 30),
      prose: num(sizes.prose, base.sizes.prose, 13, 26),
      body: num(sizes.body, base.sizes.body, 11, 18),
      meta: num(sizes.meta, base.sizes.meta, 9, 15),
      label: num(sizes.label, base.sizes.label, 8, 14),
      metric: num(sizes.metric, base.sizes.metric, 18, 44),
    },
    weights: {
      headline: num(weights.headline, base.weights.headline, 300, 800),
      prose: num(weights.prose, base.weights.prose, 300, 700),
      label: num(weights.label, base.weights.label, 400, 800),
      metric: num(weights.metric, base.weights.metric, 200, 700),
    },
    tracking: {
      headline: em(tracking.headline, base.tracking.headline),
      label: em(tracking.label, base.tracking.label),
    },
    lineHeight: {
      display: num(lineHeight.display, base.lineHeight.display, 0.9, 1.4),
      editorial: num(lineHeight.editorial, base.lineHeight.editorial, 1, 1.5),
      prose: num(lineHeight.prose, base.lineHeight.prose, 1.3, 2),
      body: num(lineHeight.body, base.lineHeight.body, 1.2, 1.8),
    },
  };
}

function mergeShape(v: unknown, base: Shape): Shape {
  if (!isRecord(v)) return base;
  const radius = isRecord(v.radius) ? v.radius : {};
  const borderWidth = isRecord(v.borderWidth) ? v.borderWidth : {};
  return {
    radius: {
      sm: num(radius.sm, base.radius.sm, 0, 24),
      md: num(radius.md, base.radius.md, 0, 28),
      lg: num(radius.lg, base.radius.lg, 0, 32),
      xl: num(radius.xl, base.radius.xl, 0, 40),
      pill: num(radius.pill, base.radius.pill, 0, 999),
      circle:
        radius.circle === "0px" || radius.circle === "50%"
          ? radius.circle
          : base.radius.circle,
    },
    borderWidth: {
      hairline: num(borderWidth.hairline, base.borderWidth.hairline, 0.5, 2),
      strong: num(borderWidth.strong, base.borderWidth.strong, 1, 4),
    },
  };
}
