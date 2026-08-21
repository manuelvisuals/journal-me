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
  invalidateAll();
  return getStore().addGoal(label);
}

export async function removeGoal(_mode: DataMode, id: string): Promise<void> {
  invalidateAll();
  return getStore().removeGoal(id);
}
