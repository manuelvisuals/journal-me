/**
 * Registry dei temi inclusi. Tipizzato: se un tema manca o e malformato,
 * tsc se ne accorge qui.
 */
import type { Theme } from "./contract";
import { minimal } from "./minimal";
import { wine } from "./wine";
import { carta } from "./carta";
import { malva } from "./malva";
import { macchina } from "./macchina";

export const THEMES: readonly Theme[] = [minimal, wine, carta, malva, macchina];

export function themeById(id: string | null | undefined): Theme {
  return THEMES.find((t) => t.id === id) ?? minimal;
}

export {
  DEFAULT_THEME_ID,
  DEFAULT_APPEARANCE,
  THEME_STORAGE_KEY,
  APPEARANCE_STORAGE_KEY,
  cssVarsFor,
  resolveTheme,
} from "./contract";
export type { Theme, ColorSet, Mode, Appearance } from "./contract";
export { validateTheme } from "./validate";
export { FONTS } from "./fonts";
export type { FontId } from "./fonts";
