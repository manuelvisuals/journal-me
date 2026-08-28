"use client";

/**
 * Le aree lette dal client: servono a disegnare la giornata (nomi, ordine,
 * icone) e la schermata dei chiarimenti.
 *
 * DUE REGOLE CHE NON SI POSSONO ROMPERE.
 *
 * 1. In modalita locale non si tocca la rete. E la promessa piu importante
 *    dell'app (SPEC-v2 §1) e ha un banco che la controlla: chi tiene il
 *    diario sul telefono vede le aree cotte dentro il pacchetto, punto.
 * 2. Il primo render non aspetta nessuno. Si parte dall'elenco di fabbrica
 *    (o dalla copia in cache dell'ultima volta) e, se arriva qualcosa di
 *    diverso dal database, si aggiorna. Una schermata che resta vuota
 *    mentre carica sei etichette sarebbe un peggioramento.
 *
 * Il valore si legge con useSyncExternalStore e non con useEffect +
 * setState: regola di React 19 gia pagata altrove nel progetto.
 */

import { useSyncExternalStore } from "react";
import { AREE_DI_FABBRICA, areaDaRiga, urlAree, type Area } from "@/lib/aree";
import { useStorageMode } from "@/lib/data/store";

const CHIAVE_CACHE = "jm.aree";

let aree: Area[] = AREE_DI_FABBRICA;
let caricate = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

function daCache(): Area[] | null {
  try {
    const grezzo = window.localStorage.getItem(CHIAVE_CACHE);
    if (!grezzo) return null;
    const righe = JSON.parse(grezzo) as Record<string, unknown>[];
    const lette = righe.map(areaDaRiga).filter((a): a is Area => a !== null);
    return lette.length > 0 ? lette : null;
  } catch {
    return null;
  }
}

function inCache(righe: unknown): void {
  try {
    window.localStorage.setItem(CHIAVE_CACHE, JSON.stringify(righe));
  } catch {
    // niente cache: si rileggera la prossima volta
  }
}

function carica(): void {
  if (caricate) return;
  caricate = true;

  const salvate = daCache();
  if (salvate) {
    aree = salvate;
    emit();
  }

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !key) return;

  void fetch(urlAree(base), {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((righe: Record<string, unknown>[] | null) => {
      if (!righe) return;
      const lette = righe.map(areaDaRiga).filter((a): a is Area => a !== null);
      if (lette.length === 0) return;
      aree = lette;
      inCache(righe);
      emit();
    })
    .catch(() => {
      // il database non risponde: restano quelle di fabbrica
    });
}

export function useAree(): Area[] {
  const mode = useStorageMode();
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      // Solo fuori dalla modalita locale: li la rete non si tocca.
      if (mode === "cloud") carica();
      return () => {
        listeners.delete(l);
      };
    },
    () => aree,
    () => AREE_DI_FABBRICA,
  );
}
