"use client";

/**
 * La factory dello store (SPEC-v2 §2.2-2.3).
 *
 * Oggi esiste una sola implementazione (CloudStore): la risoluzione
 * asincrona della modalita — flag "jm.mode" in localStorage prima, poi
 * getAccessToken(), poi "none" e /benvenuto — arriva con la PR 3
 * (store-local), insieme a LocalStore, allo stato `resolving` e all'hook
 * useStorageMode() basato su useSyncExternalStore. Fino ad allora la
 * factory e sincrona e restituisce sempre il cloud: identico a prima.
 */

import { CloudStore } from "./cloud";
import type { JournalStore } from "./types";

let store: JournalStore | null = null;

export function getStore(): JournalStore {
  if (!store) store = new CloudStore();
  return store;
}

export type {
  AIFields,
  BackupFile,
  ImportReport,
  JournalStore,
  StorageMode,
} from "./types";
