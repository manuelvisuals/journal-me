"use client";

/**
 * La factory dello store e la risoluzione della modalita (SPEC-v2 §2.2-2.3).
 *
 * Ordine di risoluzione, una volta sola per sessione, ASINCRONA:
 *   1. flag "jm.mode" === "local" in localStorage  -> "local"   (sincrono, PRIMO:
 *      un utente locale non deve mai aspettare una promise di Supabase, e in
 *      locale il client Supabase non si costruisce nemmeno — import dinamico
 *      solo nel ramo cloud)
 *   2. getAccessToken() -> token valido             -> "cloud"
 *   3. nessuno dei due                              -> "none"   (-> /benvenuto, PR 5)
 *
 * Mai leggere a mano la chiave sb-<ref>-auth-token: e una convenzione
 * interna di supabase-js e dal blob non si vede se il token e scaduto.
 *
 * I componenti NON leggono la modalita da soli: usano useStorageMode(),
 * che espone il valore gia risolto via useSyncExternalStore (niente
 * useEffect + setState, lint React 19 / HANDOVER §7).
 */

import { useSyncExternalStore } from "react";
import { CloudStore } from "./cloud";
import { LocalStore } from "./local";
import type { JournalStore } from "./types";

export type ResolvedMode = "resolving" | "local" | "cloud" | "none";

export const LOCAL_MODE_KEY = "jm.mode";

let resolved: ResolvedMode = "resolving";
let resolving: Promise<ResolvedMode> | null = null;

const listeners = new Set<() => void>();
function emit(): void {
  for (const l of listeners) l();
}
function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

function settle(mode: ResolvedMode): ResolvedMode {
  resolved = mode;
  emit();
  return mode;
}

export function resolveStorageMode(): Promise<ResolvedMode> {
  if (resolved !== "resolving") return Promise.resolve(resolved);
  if (resolving) return resolving;
  resolving = (async () => {
    // 1. Il ramo locale e sincrono e viene PRIMA: niente rete, niente client.
    try {
      if (window.localStorage.getItem(LOCAL_MODE_KEY) === "local") {
        return settle("local");
      }
    } catch {
      // storage negato: si prosegue col ramo cloud
    }
    // 2. Solo qui il client Supabase viene costruito (import dinamico).
    try {
      const { getAccessToken } = await import("@/lib/supabase/client");
      const token = await getAccessToken();
      if (token) return settle("cloud");
    } catch {
      // env mancanti o storage rotto: nessuna sessione cloud possibile
    }
    return settle("none");
  })();
  return resolving;
}

/**
 * Scelta esplicita della modalita locale (la fara /benvenuto, PR 5).
 * Scrive il flag e risolve subito, senza toccare Supabase.
 */
export function chooseLocalMode(): void {
  try {
    window.localStorage.setItem(LOCAL_MODE_KEY, "local");
  } catch {
    // il flag non persiste, ma la sessione corrente e comunque locale
  }
  resolving = null;
  settle("local");
}

/** Abbandono della modalita locale (migrazione locale -> cloud, PR 5+). */
export function clearLocalMode(): void {
  try {
    window.localStorage.removeItem(LOCAL_MODE_KEY);
  } catch {
    // niente da rimuovere
  }
  resolved = "resolving";
  resolving = null;
  void resolveStorageMode();
}

export function useStorageMode(): ResolvedMode {
  if (typeof window !== "undefined") void resolveStorageMode();
  return useSyncExternalStore(
    subscribe,
    () => resolved,
    () => "resolving" as const,
  );
}

/* ----------------- factory ----------------- */

let cloudStore: JournalStore | null = null;
let localStore: JournalStore | null = null;

/**
 * Lo store della modalita corrente. Finche la modalita non e risolta (o e
 * "none") risponde il cloud: e il comportamento storico, e le schermate
 * dati stanno comunque dietro AuthGate.
 */
export function getStore(): JournalStore {
  if (resolved === "local") {
    if (!localStore) localStore = new LocalStore();
    return localStore;
  }
  if (!cloudStore) cloudStore = new CloudStore();
  return cloudStore;
}

export type {
  AIFields,
  BackupFile,
  ImportReport,
  JournalStore,
  StorageMode,
} from "./types";
