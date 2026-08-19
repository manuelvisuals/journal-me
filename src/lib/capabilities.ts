"use client";

/**
 * Cosa puo fare il client nella modalita corrente (SPEC-v2 §3.3).
 *
 * Il client usa can() SOLO per la UI e per non partire nemmeno con le
 * chiamate AI in locale: la decisione vera resta sul server
 * (requirePremium, 401/402). Non deve mai esistere una schermata in cui il
 * client crede di poter chiamare un endpoint e si becca un 402 a sorpresa.
 *
 * Oggi esiste solo la modalita cloud, quindi tutte le capability sono
 * accese: con la PR 3 (store-local) diventano mode-based, con la PR 10
 * (gating-ui) anche plan-based.
 */

import { getStore } from "@/lib/data/store";

export type Capability = "voice" | "aiSummary" | "recap" | "patterns" | "sync";

export function can(_c: Capability): boolean {
  return getStore().mode === "cloud";
}
