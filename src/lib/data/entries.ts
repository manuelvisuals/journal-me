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
  invalidateAll();
  return getStore().deleteEntry(dateISO);
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
  invalidateAll();
  return reprocessEntryTranscript(dateISO, newTranscript);
}

export async function updateMetric(
  _mode: DataMode,
  dateISO: string,
  patch: Partial<EntryMetrics>,
): Promise<Entry> {
  invalidateAll();
  return getStore().updateMetric(dateISO, patch);
}

export async function toggleGoal(
  _mode: DataMode,
  dateISO: string,
  label: string,
): Promise<Entry> {
  invalidateAll();
  return getStore().toggleGoal(dateISO, label);
}

export async function saveEntryPeople(
  _mode: DataMode,
  dateISO: string,
  people: string[],
): Promise<Entry> {
  invalidateAll();
  return getStore().saveEntryPeople(dateISO, people);
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
  invalidateAll();
  return getStore().saveHeadline(dateISO, headline);
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
  invalidateAll();
  return getStore().saveAreas(dateISO, areas);
}
