/**
 * Registry dei temi inclusi. Tipizzato: se un tema manca o e malformato,
 * tsc se ne accorge qui.
 *
 * I nove regalati da Nikita Rodionov il 5 settembre 2026 stanno in
 * SPEC-temi-regalati.md; le licenze delle palette pubbliche e la provenienza
 * per esteso di Ametista stanno in LICENZE-TERZE-PARTI.md.
 *
 * L ORDINE DI QUESTO ELENCO E LA SCHERMATA TEMA. Quattordici schede in fila
 * hanno bisogno di un filo, e il filo scelto (Manuel, 5 settembre 2026) e la
 * somiglianza, non la provenienza: i temi di casa e quelli regalati sono
 * mescolati. La regola, per poterla rifare identica domani: si guarda
 * l accento del set scuro, i due neutri (saturazione sotto 0,15) vanno in
 * testa nell ordine storico, gli altri seguono la ruota dei colori tagliata a
 * 330 gradi - rosa, corallo, arancio, verde-acqua, azzurro, viola. Chi si
 * somiglia finisce vicino, e scorrendo si vede una sfumatura sola invece di
 * quattordici salti.
 */
import type { Theme } from "./contract";
import { minimal } from "./minimal";
import { macchina } from "./macchina";
import { malva } from "./malva";
import { ardesia } from "./ardesia";
import { korall } from "./korall";
import { carta } from "./carta";
import { gruvbox } from "./gruvbox";
import { wine } from "./wine";
import { grafit } from "./grafit";
import { nord } from "./nord";
import { ocean } from "./ocean";
import { tokyo } from "./tokyo";
import { ametista } from "./ametista";
import { catppuccin } from "./catppuccin";

export const THEMES: readonly Theme[] = [
  minimal, // neutro
  macchina, // neutro
  malva, // rosa 341
  ardesia, // corallo 0, fondo freddo
  korall, // corallo 0, fondo caldo
  carta, // arancio 24
  gruvbox, // arancio 27
  wine, // arancio 30
  grafit, // verde-acqua 170
  nord, // azzurro 193
  ocean, // azzurro 198
  tokyo, // azzurro 221
  ametista, // viola 265
  catppuccin, // viola 267
];

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
