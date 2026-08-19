"use client";

/**
 * Cosa puo fare il client nella modalita corrente (SPEC-v2 §3.3).
 *
 * Il client usa can() SOLO per la UI e per non partire nemmeno con le
 * chiamate AI in locale: la decisione vera resta sul server
 * (requirePremium, 401/402). Non deve mai esistere una schermata in cui il
 * client crede di poter chiamare un endpoint e si becca un 402 a sorpresa.
 *
 * Dalla PR 10 e anche plan-based: in locale tutto spento, in cloud `sync`
 * e sempre acceso (i dati SONO nel cloud) e il resto dipende da
 * profiles.plan (via src/lib/plan.ts, cache + refresh in background).
 */

import { getStore, useStorageMode } from "@/lib/data/store";
import { getPlanSync, usePlan } from "@/lib/plan";

export type Capability = "voice" | "aiSummary" | "recap" | "patterns" | "sync";

export function can(c: Capability): boolean {
  if (getStore().mode !== "cloud") return false;
  if (c === "sync") return true;
  return getPlanSync() === "premium";
}

/**
 * Versione reattiva per i componenti: si aggiorna quando il piano arriva
 * dal refresh in background o quando la modalita si risolve.
 */
export function useCan(c: Capability): boolean {
  const plan = usePlan();
  const mode = useStorageMode();
  // Stessa semantica di can(): finche la modalita non e risolta risponde
  // il ramo cloud (le schermate dati stanno comunque dietro AuthGate).
  if (mode === "local") return false;
  if (c === "sync") return true;
  return plan === "premium";
}
