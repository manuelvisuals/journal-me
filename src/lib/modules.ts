"use client";

/**
 * I moduli: sezioni in piu, accese solo da chi le vuole.
 *
 * Richiesta di Manuel del 21 agosto 2026, con il modulo Palestra come primo
 * caso (mockup design/mockups/palestra.html). Le regole che ha dettato, e
 * che sono tutte qui dentro invece che sparse nelle schermate:
 *
 *  - un modulo acceso va IN CIMA all'elenco e prende la quarta icona della
 *    barra del telefono. Accendendone un secondo, il secondo passa davanti;
 *  - sul telefono ne compare uno solo (la barra ha cinque posti e il
 *    microfono al centro non si tocca): gli altri stanno in Altro;
 *  - sul desktop ci sono tutti, incolonnati nella barra di sinistra, dove
 *    lo spazio c'e;
 *  - spegnere un modulo NON cancella niente. E la prima paura di chi tocca
 *    un interruttore, e la risposta deve essere scritta, non dedotta.
 *
 * DOVE VIVE LA SCELTA. In `localStorage`, come il tema e la lingua: e una
 * preferenza di questo dispositivo, non un dato del diario. Chi apre l'app
 * dal telefono e dal computer puo volere due barre diverse, e nessuna delle
 * due e "sbagliata".
 *
 * PERCHE UN ELENCO ORDINATO E NON UN INSIEME. L'ordine E l'informazione:
 * dice qual e il modulo che comanda la quarta icona. Un insieme di
 * accesi/spenti costringerebbe a inventare un criterio (alfabetico? di
 * registrazione?) e il piu recente non sarebbe piu il primo.
 */

import { useSyncExternalStore } from "react";

export type ModuleId = "palestra" | "cibo" | "sonno" | "meditazione";

export type ModuleDef = {
  id: ModuleId;
  /** Nome mostrato. E anche la chiave di traduzione. */
  label: string;
  /** Una riga che dice cosa fa, non cosa e. */
  description: string;
  href: string;
  /**
   * `pronto` si accende; `presto` no, ed e detto in chiaro. Un interruttore
   * che si muove senza che succeda niente e peggio di un interruttore che
   * non c'e.
   */
  status: "pronto" | "presto";
};

export const MODULES: ModuleDef[] = [
  {
    id: "palestra",
    label: "Palestra",
    description: "Allenamenti, serie e progressi",
    href: "/palestra",
    status: "pronto",
  },
  {
    id: "cibo",
    label: "Cibo",
    description: "Cosa mangi, quanto spesso, e come cambia",
    href: "/cibo",
    status: "presto",
  },
  {
    id: "sonno",
    label: "Sonno",
    description: "Ore, regolarita, e come va il giorno dopo",
    href: "/sonno",
    status: "presto",
  },
  {
    id: "meditazione",
    label: "Meditazione",
    description: "Minuti, costanza, e cosa cambia nei giorni in cui la fai",
    href: "/meditazione",
    status: "presto",
  },
];

export function moduleById(id: string): ModuleDef | undefined {
  return MODULES.find((m) => m.id === id);
}

export const MODULES_STORAGE_KEY = "jm:moduli";

/** Gli accesi, dal piu recente. Il primo comanda la quarta icona. */
let active: ModuleId[] = [];
let read = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

function load(): ModuleId[] {
  if (read) return active;
  read = true;
  try {
    const raw = window.localStorage.getItem(MODULES_STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Solo i moduli PRONTI sopravvivono alla lettura. Un id vecchio o
        // scritto a mano metterebbe nella barra una voce che porta a una
        // pagina inesistente, e il danno lo vedrebbe l'utente, non chi lo
        // ha scritto.
        active = parsed.filter((id): id is ModuleId => {
          if (typeof id !== "string") return false;
          const def = moduleById(id);
          return !!def && def.status === "pronto";
        });
      }
    }
  } catch {
    // storage negato o valore rotto: si parte senza moduli, che e lo stato
    // normale di chi non ne ha mai acceso uno.
  }
  return active;
}

function save(): void {
  try {
    window.localStorage.setItem(MODULES_STORAGE_KEY, JSON.stringify(active));
  } catch {
    // pazienza: la sessione corrente funziona lo stesso
  }
}

export function getActiveModules(): ModuleId[] {
  if (typeof window === "undefined") return [];
  return load();
}

export function isModuleActive(id: ModuleId): boolean {
  return getActiveModules().includes(id);
}

/**
 * Accende o spegne. Acceso, il modulo va IN CIMA: e la regola che rende
 * prevedibile quale sia la quarta icona, senza doverlo spiegare da nessuna
 * parte.
 */
export function setModuleActive(id: ModuleId, on: boolean): void {
  const def = moduleById(id);
  if (!def || def.status !== "pronto") return;
  load();
  active = active.filter((x) => x !== id);
  if (on) active = [id, ...active];
  save();
  emit();
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

const EMPTY: ModuleId[] = [];

/**
 * L'elenco reattivo.
 *
 * Il terzo argomento (lo snapshot del server) risponde SEMPRE vuoto: il
 * server non conosce il localStorage, e se il primo disegno del browser
 * mostrasse gia la barra con il modulo, React troverebbe due HTML diversi e
 * l'idratazione fallirebbe. Cosi invece il primo disegno e identico a
 * quello del server e il modulo compare un istante dopo, da solo.
 *
 * `load()` restituisce sempre lo STESSO array (non una copia): con un
 * oggetto nuovo a ogni chiamata, React vedrebbe un cambiamento a ogni
 * disegno e ridisegnerebbe all'infinito.
 */
export function useActiveModules(): ModuleDef[] {
  const ids = useSyncExternalStore(
    subscribe,
    () => (typeof window === "undefined" ? EMPTY : load()),
    () => EMPTY,
  );
  return ids
    .map((id) => moduleById(id))
    .filter((m): m is ModuleDef => m !== undefined);
}
