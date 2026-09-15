"use client";

/**
 * Lista o griglia: la scelta di come si guarda il Mese sul telefono.
 *
 * Vive in localStorage, non in sessionStorage e non nell'indirizzo: e una
 * preferenza vera (se chiudi in lista, domani riapri in lista), non lo
 * stato di un momento. Sul computer non conta niente: da lg comanda sempre
 * la griglia grande.
 *
 * Deciso da Manuel il 15 settembre 2026: si parte in griglia (a scacchiera),
 * non piu in lista. La chiave in localStorage ha cambiato significato:
 * prima teneva la scelta "griglia" (eccezione), ora tiene la scelta
 * "lista" (eccezione) - cosi chi non ha mai toccato il tasto vede subito
 * la griglia, e chi aveva scelto la lista prima del 15 settembre la
 * ritrova lista solo se la riseleziona di nuovo (la vecchia chiave "griglia"
 * viene semplicemente ignorata, che e comunque il nuovo default).
 *
 * Il valore si legge con useSyncExternalStore e non con useEffect +
 * setState: e la regola di React 19 gia pagata altrove nel progetto
 * (react-hooks/set-state-in-effect).
 */

import { useSyncExternalStore } from "react";

const KEY = "jm.mese.vista";

let griglia = true;
let restored = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

/** Ripristino da localStorage, una volta sola, dopo il mount. */
function restoreOnce(): void {
  if (restored) return;
  restored = true;
  try {
    if (window.localStorage.getItem(KEY) === "lista") {
      griglia = false;
      emit();
    }
  } catch {
    // niente persistenza: si resta sulla griglia, che e il valore di partenza
  }
}

export function setVistaGriglia(on: boolean): void {
  griglia = on;
  try {
    if (on) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, "lista");
  } catch {
    // vale comunque per questa sessione
  }
  emit();
}

export function useVistaGriglia(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      restoreOnce();
      return () => {
        listeners.delete(l);
      };
    },
    () => griglia,
    // Sul server la griglia e sempre il valore di partenza: il ripristino
    // avviene dopo il mount, quindi il primo render combacia.
    () => true,
  );
}
