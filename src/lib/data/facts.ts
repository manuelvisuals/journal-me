"use client";

/**
 * I fatti, lato app: la facciata sopra lo store, come entries.ts e goals.ts.
 *
 * Le letture passano dalla cache e le scritture la svuotano, esattamente
 * come tutto il resto: cosi ogni schermata nuova eredita il precaricamento
 * senza doverselo ricordare (SPEC-v2 §2.2).
 */

import { cached, invalidateAll } from "@/lib/data/cache";
import { getStore } from "@/lib/data/store";
import type { DataMode } from "@/lib/data/entries";
import type { Fact, NewFact } from "@/lib/types";

export async function loadFactsForDate(
  _mode: DataMode,
  dateISO: string,
): Promise<Fact[]> {
  return cached(`facts:${dateISO}`, () => getStore().loadFactsForDate(dateISO));
}

export async function loadFactsForMonth(
  _mode: DataMode,
  year: number,
  month: number,
): Promise<Fact[]> {
  return cached(`facts:month:${year}-${month}`, () =>
    getStore().loadFactsForMonth(year, month),
  );
}

/** Le etichette gia usate, da passare al modello perche le riusi. */
export async function loadKnownLabels(_mode?: DataMode): Promise<string[]> {
  return cached("facts:labels", () => getStore().loadKnownLabels());
}

/** Rifa i fatti letti dall'AI per una giornata. Vedi lo store per il perche. */
export async function replaceAiFacts(
  _mode: DataMode,
  dateISO: string,
  facts: NewFact[],
): Promise<Fact[]> {
  invalidateAll();
  return getStore().replaceAiFacts(dateISO, facts);
}
