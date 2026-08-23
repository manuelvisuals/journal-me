"use client";

import { useEffect } from "react";
import { markHydrated } from "@/lib/i18n";
import { markUiScaleHydrated } from "@/lib/ui-scale";
import { isReady, onReady } from "@/lib/app-ready";
import { warmAll } from "@/lib/data/warm";

/**
 * Montato nel layout, non disegna niente. Fa due cose:
 *  - accende la traduzione DOPO l'idratazione (vedi la nota in
 *    src/lib/i18n/index.ts: prima il client deve renderizzare lo stesso
 *    HTML italiano che ha mandato il server, o React protesta in console);
 *  - allinea <html lang> alla lingua effettiva.
 *
 * Fa la stessa cosa per la DIMENSIONE dell'interfaccia: lo zoom lo ha gia
 * messo lo script di boot, qui si allinea solo cio che React sa, e per lo
 * stesso motivo (il server renderizza a scala 1).
 *
 * Fa partire anche il PRECARICAMENTO degli altri tab, ma solo dopo che la
 * prima schermata e pronta: prima significherebbe mettere quattro
 * richieste in coda davanti a quella che l'utente sta aspettando.
 *
 * Gemello di ThemeWatcher, e per lo stesso motivo: la preferenza vive
 * fuori da React e qualcuno deve dire a React quando guardarla.
 */
export function LangWatcher() {
  useEffect(() => {
    markHydrated();
    markUiScaleHydrated();
  }, []);

  useEffect(() => {
    // Un respiro dopo il segnale di pronto: la schermata deve finire di
    // disegnarsi prima che partano altre richieste.
    const later = () => window.setTimeout(() => void warmAll(), 400);
    if (isReady()) {
      const id = later();
      return () => window.clearTimeout(id);
    }
    let id: number | null = null;
    const off = onReady(() => {
      id = later();
    });
    return () => {
      off();
      if (id !== null) window.clearTimeout(id);
    };
  }, []);

  return null;
}
