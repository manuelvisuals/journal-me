"use client";

/**
 * Lista o griglia: la scelta di come si guarda il Mese sul telefono.
 *
 * Vive in localStorage, non in sessionStorage e non nell'indirizzo: e una
 * preferenza vera (se chiudi in griglia, domani riapri in griglia), non lo
 * stato di un momento. Sul computer non conta niente: da lg comanda sempre
 * la griglia grande.
 *
 * Il valore si legge con useSyncExternalStore e non con useEffect +
 * setState: e la regola di React 19 gia pagata altrove nel progetto
 * (react-hooks/set-state-in-effect).
 */

import { useSyncExternalStore } from "react";

const KEY = "jm.mese.vista";

let griglia = false;
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
    if (window.localStorage.getItem(KEY) === "griglia") {
      griglia = true;
      emit();
    }
  } catch {
    // niente persistenza: si resta sulla lista, che e il valore di partenza
  }
}

export function setVistaGriglia(on: boolean): void {
  griglia = on;
  try {
    if (on) window.localStorage.setItem(KEY, "griglia");
    else window.localStorage.removeItem(KEY);
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
    // Sul server la lista e sempre il valore di partenza: il ripristino
    // avviene dopo il mount, quindi il primo render combacia.
    () => false,
  );
}
