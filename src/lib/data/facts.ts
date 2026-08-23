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
import type { Alias, DayExclusion, Fact, NewFact } from "@/lib/types";

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

/**
 * I soprannomi gia chiariti. Passano dalla cache come tutto il resto: li
 * legge ogni schermata che mostra persone o luoghi, quindi sarebbero
 * altrimenti la lettura piu frequente dell'app.
 */
export async function loadAliases(_mode?: DataMode): Promise<Alias[]> {
  return cached("aliases", () => getStore().loadAliases());
}

/** Chiarisce un soprannome, per sempre. Vale da subito su tutto lo storico. */
export async function saveAlias(
  _mode: DataMode,
  alias: Alias,
): Promise<Alias[]> {
  invalidateAll();
  return getStore().saveAlias(alias);
}

/* --- cose tolte a mano da una giornata (migrazione 013) --- */

export async function loadExclusions(
  _mode: DataMode,
  dateISO: string,
): Promise<DayExclusion[]> {
  return cached(`escluse:${dateISO}`, () => getStore().loadExclusions(dateISO));
}

export async function addExclusion(
  _mode: DataMode,
  e: DayExclusion,
): Promise<void> {
  invalidateAll();
  return getStore().addExclusion(e);
}

export async function removeExclusion(
  _mode: DataMode,
  e: DayExclusion,
): Promise<void> {
  invalidateAll();
  return getStore().removeExclusion(e);
}
