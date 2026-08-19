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
 */

import { getStore } from "@/lib/data/store";
import { reprocessEntryTranscript } from "@/lib/actions/save-recording";
import type { Entry, EntryMetrics } from "@/lib/types";

/**
 * After the move to Supabase Anonymous Auth, every user has a real
 * user_id (regular or anon). DataMode is kept as a type alias for
 * call-site compatibility but always equals "auth" in practice — the
 * real local/cloud resolution arrives with PR 3 (store-local).
 */
export type DataMode = "auth";

export async function loadTodayEntry(_mode?: DataMode): Promise<Entry | null> {
  return getStore().loadTodayEntry();
}

export async function loadEntryForDate(
  _mode: DataMode,
  dateISO: string,
): Promise<Entry | null> {
  return getStore().loadEntryForDate(dateISO);
}

export async function loadMonthEntries(
  _mode: DataMode,
  year: number,
  month: number,
): Promise<Entry[]> {
  return getStore().loadMonthEntries(year, month);
}

export async function deleteEntry(
  _mode: DataMode,
  dateISO: string,
): Promise<void> {
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
  return reprocessEntryTranscript(dateISO, newTranscript);
}

export async function updateMetric(
  _mode: DataMode,
  dateISO: string,
  patch: Partial<EntryMetrics>,
): Promise<Entry> {
  return getStore().updateMetric(dateISO, patch);
}

export async function toggleGoal(
  _mode: DataMode,
  dateISO: string,
  label: string,
): Promise<Entry> {
  return getStore().toggleGoal(dateISO, label);
}

export async function saveEntryPeople(
  _mode: DataMode,
  dateISO: string,
  people: string[],
): Promise<Entry> {
  return getStore().saveEntryPeople(dateISO, people);
}
