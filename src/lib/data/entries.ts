"use client";

/**
 * Facade sopra JournalStore (SPEC-v2 §2.2). Le firme storiche restano
 * identiche, primo parametro `_mode` compreso: resta ignorato come oggi,
 * la modalita la decide la factory (getStore), non il chiamante. Cosi i
 * call-site nella UI non cambiano comportamento.
 *
 * Il corpo delle funzioni vive in src/lib/data/store/cloud.ts (CloudStore).
 * `saveRecording` non abita piu qui: e orchestrazione AI e sta in
 * src/lib/actions/save-recording.ts.
 *
 * Le LETTURE passano dalla cache (src/lib/data/cache.ts) e le SCRITTURE la
 * svuotano. Sta qui e non nelle pagine perche queste funzioni sono l'unico
 * punto d'accesso ai dati: cosi ogni schermata, anche una scritta domani,
 * eredita il precaricamento senza doverselo ricordare.
 */

import { getStore } from "@/lib/data/store";
import { cached, invalidateAll } from "@/lib/data/cache";
import { reprocessEntryTranscript } from "@/lib/actions/save-recording";
import type { AreaSummary, Entry, EntryMetrics } from "@/lib/types";
import type { Contenuto } from "@/lib/data/store/cassettine";
import type { CloudStore } from "@/lib/data/store/cloud";

/**
 * After the move to Supabase Anonymous Auth, every user has a real
 * user_id (regular or anon). DataMode is kept as a type alias for
 * call-site compatibility but always equals "auth" in practice — the
 * real local/cloud resolution arrives with PR 3 (store-local).
 */
export type DataMode = "auth";

export async function loadTodayEntry(_mode?: DataMode): Promise<Entry | null> {
  return cached("entry:today", () => getStore().loadTodayEntry());
}

export async function loadEntryForDate(
  _mode: DataMode,
  dateISO: string,
): Promise<Entry | null> {
  return cached(`entry:${dateISO}`, () => getStore().loadEntryForDate(dateISO));
}

export async function loadMonthEntries(
  _mode: DataMode,
  year: number,
  month: number,
): Promise<Entry[]> {
  return cached(`month:${year}-${month}`, () =>
    getStore().loadMonthEntries(year, month),
  );
}

export async function deleteEntry(
  _mode: DataMode,
  dateISO: string,
): Promise<void> {
  // Si svuota DOPO la scrittura: vedi invalidateAll in cache.ts.
  try {
    return await getStore().deleteEntry(dateISO);
  } finally {
    invalidateAll();
  }
}

/**
 * Stesso comportamento di sempre: il transcript corretto ripassa dall'AI
 * (titolo e sintesi si rigenerano) e poi si salva. L'orchestrazione vive
 * nell'azione; questa firma resta per i call-site esistenti.
 */
export async function updateEntryTranscript(
  _mode: DataMode,
  dateISO: string,
  newTranscript: string,
): Promise<Entry> {
  // Si svuota DOPO la scrittura: vedi invalidateAll in cache.ts.
  try {
    return await reprocessEntryTranscript(dateISO, newTranscript);
  } finally {
    invalidateAll();
  }
}

export async function updateMetric(
  _mode: DataMode,
  dateISO: string,
  patch: Partial<EntryMetrics>,
): Promise<Entry> {
  // Si svuota DOPO la scrittura: vedi invalidateAll in cache.ts.
  try {
    return await getStore().updateMetric(dateISO, patch);
  } finally {
    invalidateAll();
  }
}

export async function toggleGoal(
  _mode: DataMode,
  dateISO: string,
  label: string,
): Promise<Entry> {
  // Si svuota DOPO la scrittura: vedi invalidateAll in cache.ts.
  try {
    return await getStore().toggleGoal(dateISO, label);
  } finally {
    invalidateAll();
  }
}

export async function saveEntryPeople(
  _mode: DataMode,
  dateISO: string,
  people: string[],
): Promise<Entry> {
  // Si svuota DOPO la scrittura: vedi invalidateAll in cache.ts.
  try {
    return await getStore().saveEntryPeople(dateISO, people);
  } finally {
    invalidateAll();
  }
}

/**
 * Scrive il titolo a mano e lo blocca (22 agosto 2026).
 *
 * Da qui in poi nessuna rilettura del racconto lo tocca piu: e una scelta
 * senza strada indietro dall'app, ed e voluta. Il titolo e la prima cosa che
 * rileggerai fra sei mesi, e se hai deciso come si chiama quella giornata
 * non deve poterlo cambiare nessuno.
 */
export async function saveHeadline(
  _mode: DataMode,
  dateISO: string,
  headline: string,
): Promise<Entry> {
  // Si svuota DOPO la scrittura: vedi invalidateAll in cache.ts.
  try {
    return await getStore().saveHeadline(dateISO, headline);
  } finally {
    invalidateAll();
  }
}

/** La sintesi riscritta a mano: stessa regola del titolo, tua per sempre. */
export async function saveSnippet(
  _mode: DataMode,
  dateISO: string,
  snippet: string,
): Promise<Entry> {
  // Si svuota DOPO la scrittura: vedi invalidateAll in cache.ts.
  try {
    return await getStore().saveSnippet(dateISO, snippet);
  } finally {
    invalidateAll();
  }
}

/**
 * Riscrive solo le aree di una giornata. La usano le risposte ai chiarimenti:
 * vedi il contratto in src/lib/data/store/types.ts per il perche non si
 * rianalizza il testo.
 */
export async function saveAreas(
  _mode: DataMode,
  dateISO: string,
  areas: AreaSummary[],
): Promise<Entry> {
  // Si svuota DOPO la scrittura: vedi invalidateAll in cache.ts.
  try {
    return await getStore().saveAreas(dateISO, areas);
  } finally {
    invalidateAll();
  }
}

/**
 * Dopo un conflitto di versione (SPEC R7): scrive la versione che la
 * persona ha scelto, sopra quella corrente del server. Solo in cloud: in
 * locale non esistono versioni ne conflitti.
 */
export async function risolviConflitto(dateISO: string, contenuto: Contenuto): Promise<Entry> {
  invalidateAll();
  const store = getStore();
  if (store.mode !== "cloud") throw new Error("Nessun conflitto in modalita locale");
  return (store as CloudStore).scriviVersioneScelta(dateISO, contenuto);
}
