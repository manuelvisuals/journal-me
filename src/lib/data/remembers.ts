"use client";

/**
 * Facade sopra JournalStore: firme storiche invariate, corpo in
 * src/lib/data/store/cloud.ts. Vedi entries.ts per il perche.
 */

import { getStore } from "@/lib/data/store";
import type { DataMode } from "@/lib/data/entries";
import type { Remember, RememberKind } from "@/lib/types";

export async function loadRemembers(_mode: DataMode): Promise<Remember[]> {
  return getStore().loadRemembers();
}

export async function addRemember(
  _mode: DataMode,
  text: string,
  kind: RememberKind,
): Promise<Remember> {
  return getStore().addRemember(text, kind);
}

export async function deleteRemember(
  _mode: DataMode,
  id: string,
): Promise<void> {
  return getStore().deleteRemember(id);
}

export async function loadPersonaNames(_mode?: DataMode): Promise<string[]> {
  return getStore().loadPersonaNames();
}

export async function addPersonas(
  _mode: DataMode,
  names: string[],
  sourceEntryId?: string | null,
): Promise<string[]> {
  return getStore().addPersonas(names, sourceEntryId);
}

export async function updateRememberKind(
  _mode: DataMode,
  id: string,
  kind: RememberKind,
): Promise<void> {
  return getStore().updateRememberKind(id, kind);
}
