"use client";

/**
 * Facciata della cassaforte per le schermate (Impostazioni > Cassaforte):
 * quante giornate e righe sono ancora in chiaro, e il passaggio esplicito
 * (SPEC R12). Solo in cloud: in locale non c'e niente da chiudere.
 */
import { getStore } from "@/lib/data/store";
import { invalidateAll } from "@/lib/data/cache";
import type { CloudStore } from "@/lib/data/store/cloud";

export type StatoGiornate = { chiuse: number; inChiaro: number; righeInChiaro: number };

function cloud(): CloudStore {
  const store = getStore();
  if (store.mode !== "cloud") throw new Error("La cassaforte esiste solo in cloud");
  return store as CloudStore;
}

export async function contaCassaforte(): Promise<StatoGiornate> {
  const s = cloud();
  const [g, r] = await Promise.all([s.contaGiornate(), s.contaRigheInChiaro()]);
  return { ...g, righeInChiaro: r };
}

/** Porta nella cassaforte tutto cio che e ancora in chiaro. Torna quante giornate. */
export async function portaNellaCassaforte(
  avanza?: (fatte: number, totale: number) => void,
): Promise<number> {
  const n = await cloud().portaNellaCassaforte(avanza);
  invalidateAll();
  return n;
}
