"use client";

/**
 * Facade sopra JournalStore: firme storiche invariate, corpo in
 * src/lib/data/store/cloud.ts. Vedi entries.ts per il perche.
 */

import { getStore } from "@/lib/data/store";
import type { DataMode } from "@/lib/data/entries";
import type { GoalDef } from "@/lib/types";

export async function loadGoalDefs(_mode?: DataMode): Promise<GoalDef[]> {
  return getStore().loadGoalDefs();
}

export async function addGoal(
  _mode: DataMode,
  label: string,
): Promise<GoalDef> {
  return getStore().addGoal(label);
}

export async function removeGoal(_mode: DataMode, id: string): Promise<void> {
  return getStore().removeGoal(id);
}
