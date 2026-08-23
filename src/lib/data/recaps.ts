"use client";

/**
 * Facade sopra JournalStore: firme storiche invariate, corpo in
 * src/lib/data/store/cloud.ts. Vedi entries.ts per il perche.
 *
 * `generateAndSaveRecap` non abita piu qui: e orchestrazione AI e sta in
 * src/lib/actions/generate-recap.ts. `monthBoundaries` e calcolo puro di
 * date e resta dov'e.
 */

import { getStore } from "@/lib/data/store";
import { cached, invalidateAll } from "@/lib/data/cache";
import type { DataMode } from "@/lib/data/entries";
import type { Recap } from "@/lib/types";

export async function loadRecaps(_mode: DataMode): Promise<Recap[]> {
  return cached("recaps", () => getStore().loadRecaps());
}

export async function updateRecap(
  _mode: DataMode,
  id: string,
  patch: { title?: string; snippet?: string; body?: string },
): Promise<Recap> {
  invalidateAll();
  return getStore().updateRecap(id, patch);
}

/* ----------------- Period helpers ----------------- */

export function monthBoundaries(year: number, month: number) {
  const m = String(month).padStart(2, "0");
  const lastDay = new Date(year, month, 0).getDate();
  return {
    start: `${year}-${m}-01`,
    end: `${year}-${m}-${String(lastDay).padStart(2, "0")}`,
  };
}
