"use client";

/**
 * Facade sopra JournalStore: firme storiche invariate, corpo in
 * src/lib/data/store/cloud.ts. Vedi entries.ts per il perche.
 */

import { getStore } from "@/lib/data/store";
import { cached, invalidateAll } from "@/lib/data/cache";
import type { DataMode } from "@/lib/data/entries";
import type { GoalDef } from "@/lib/types";

export async function loadGoalDefs(_mode?: DataMode): Promise<GoalDef[]> {
  return cached("goals", () => getStore().loadGoalDefs());
}

export async function addGoal(
  _mode: DataMode,
  label: string,
): Promise<GoalDef> {
  // Si svuota DOPO la scrittura: vedi invalidateAll in cache.ts.
  try {
    return await getStore().addGoal(label);
  } finally {
    invalidateAll();
  }
}

export async function removeGoal(_mode: DataMode, id: string): Promise<void> {
  // Si svuota DOPO la scrittura: vedi invalidateAll in cache.ts.
  try {
    return await getStore().removeGoal(id);
  } finally {
    invalidateAll();
  }
}
