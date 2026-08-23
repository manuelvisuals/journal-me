/**
 * Il bilingue di Journal.me (task 27, chiesta da Manuel il 20 agosto 2026).
 *
 * SCELTA DI FONDO: la chiave di traduzione E la frase italiana.
 *   t("Esci dall'account")  ->  "Log out"
 * Non `t("settings.account.logout")`. Tre motivi, in ordine di peso:
 *  1. il codice resta leggibile. Con le chiavi astratte per sapere cosa
 *     dice un bottone devi aprire un secondo file, e in una revisione a
 *     mesi di distanza nessuno lo fa;
 *  2. se una frase non e ancora tradotta, esce in italiano — che e la
 *     lingua di partenza del prodotto e del suo unico utente di oggi. Con
 *     le chiavi astratte esce "settings.account.logout" davanti al
 *     cliente: un buco diventa un difetto visibile;
 *  3. si scrive un catalogo solo (l'inglese) invece di due.
 * Il prezzo: cambiare la frase italiana scollega la traduzione in
 * silenzio. Per questo c'e `scripts/verify-i18n.mjs`, che confronta le
 * chiavi del catalogo con le stringhe passate davvero a t() e fallisce sia
 * sulle traduzioni orfane sia sulle frasi non tradotte.
 *
 * PREFERENZA E RILEVAMENTO. La preferenza salvata puo essere "system",
 * "it" o "en". Di default e "system": al primo avvio si legge la lingua
 * del dispositivo (navigator.language) e si applica da sola, come chiesto.
 * Tutto quello che non e italiano o inglese cade sull'inglese.
 *
 * IDRATAZIONE. Il server non sa che lingua ha il dispositivo: renderizza
 * sempre in italiano. Se il client partisse subito in inglese React
 * troverebbe un HTML diverso da quello che si aspetta e urlerebbe in
 * console (e le suite Playwright falliscono su "zero errori console").
 * Per questo lo snapshot resta "it" finche `markHydrated()` non viene
 * chiamato dal provider a montaggio avvenuto: un render in piu, zero
 * mismatch.
 *
 * Il file NON ha "use client": lo importa anche `src/lib/format.ts`, che
 * gira anche fuori da React. Chiamare t() dal server e legale e risponde
 * in italiano — che e esattamente cio che il server deve renderizzare.
 */

import { useSyncExternalStore } from "react";
import { EN } from "@/lib/i18n/en";

export type Lang = "it" | "en";
export type LangPref = Lang | "system";

export const LANG_STORAGE_KEY = "jm:lang";

const LOCALE_TAG: Record<Lang, string> = {
  it: "it-IT",
  // en-GB e non en-US: date giorno/mese e orologio a 24 ore, cioe il
  // formato che si aspetta chi oggi usa l'app in italiano e passa
  // all'inglese. Nessuna schermata mostra un'ora, ma le date si.
  en: "en-GB",
};

let pref: LangPref | null = null;
let hydrated = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

/** La lingua del dispositivo, ridotta alle due che l'app parla. */
export function detectSystemLang(): Lang {
  if (typeof navigator === "undefined") return "it";
  const tags = [navigator.language, ...(navigator.languages ?? [])];
  for (const tag of tags) {
    if (!tag) continue;
    const base = tag.toLowerCase().split("-")[0];
    if (base === "it") return "it";
    if (base === "en") return "en";
  }
  // Ne italiano ne inglese: l'inglese e la scelta meno peggio per chi
  // parla una terza lingua.
  return "en";
}

function readPref(): LangPref {
  if (pref) return pref;
  if (typeof window === "undefined") return "system";
  try {
    const v = window.localStorage.getItem(LANG_STORAGE_KEY);
    pref = v === "it" || v === "en" || v === "system" ? v : "system";
  } catch {
    pref = "system";
  }
  return pref;
}

/** La preferenza salvata: "system", "it" o "en". */
export function getLangPref(): LangPref {
  return readPref();
}

/** La lingua effettiva, con "system" gia risolto. */
export function getLang(): Lang {
  const p = readPref();
  return p === "system" ? detectSystemLang() : p;
}

export function setLangPref(next: LangPref): void {
  pref = next;
  try {
    window.localStorage.setItem(LANG_STORAGE_KEY, next);
  } catch {
    // Storage negato: vale per questa sessione e basta.
  }
  applyHtmlLang();
  emit();
}

/** Allinea <html lang> alla lingua effettiva (screen reader, browser). */
export function applyHtmlLang(): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("lang", getLang());
}

/** La chiama il provider dopo il montaggio: da qui in poi si traduce. */
export function markHydrated(): void {
  if (hydrated) return;
  hydrated = true;
  applyHtmlLang();
  emit();
}

function snapshot(): Lang {
  return hydrated ? getLang() : "it";
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** Il tag per Intl della lingua corrente. */
export function localeTag(lang: Lang = snapshot()): string {
  return LOCALE_TAG[lang];
}

/**
 * Traduce. La chiave e la frase italiana; i segnaposto sono {nome}.
 *   t("Ciao {nome}", { nome: "Manuel" })
 */
export function t(
  phrase: string,
  vars?: Record<string, string | number>,
): string {
  const lang = snapshot();
  const out = lang === "en" ? (EN[phrase] ?? phrase) : phrase;
  if (!vars) return out;
  return out.replace(/\{(\w+)\}/g, (whole, k: string) =>
    k in vars ? String(vars[k]) : whole,
  );
}

/** La lingua corrente, reattiva. */
export function useLang(): Lang {
  return useSyncExternalStore(subscribe, snapshot, () => "it" as const);
}

/** La preferenza corrente, reattiva (per la schermata Lingua). */
export function useLangPref(): LangPref {
  return useSyncExternalStore(
    subscribe,
    () => (hydrated ? readPref() : "system"),
    () => "system" as const,
  );
}

/**
 * `t` legato alla lingua corrente. Serve la sottoscrizione, altrimenti
 * cambiare lingua non ridisegna niente: e per questo che i componenti
 * usano useT() e non t() diretto.
 */
export function useT(): typeof t {
  useLang();
  return t;
}
