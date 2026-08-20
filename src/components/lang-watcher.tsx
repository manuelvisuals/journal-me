"use client";

import { useEffect } from "react";
import { markHydrated } from "@/lib/i18n";

/**
 * Montato nel layout, non disegna niente. Fa due cose:
 *  - accende la traduzione DOPO l'idratazione (vedi la nota in
 *    src/lib/i18n/index.ts: prima il client deve renderizzare lo stesso
 *    HTML italiano che ha mandato il server, o React protesta in console);
 *  - allinea <html lang> alla lingua effettiva.
 *
 * Gemello di ThemeWatcher, e per lo stesso motivo: la preferenza vive
 * fuori da React e qualcuno deve dire a React quando guardarla.
 */
export function LangWatcher() {
  useEffect(() => {
    markHydrated();
  }, []);
  return null;
}
