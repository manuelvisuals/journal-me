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
import { ospiteAttivo } from "@/lib/ospite/flag";
import { premiumDispositivo, usePremiumDispositivo } from "@/lib/ospite/stato";

/**
 * L'OSPITE (SPEC-ospite-e-cassaforte R2): tiene le giornate sul dispositivo
 * (modalita locale) e ha l'AI accesa a quota regalata. Il client non conosce
 * la quota: dice "si puo provare" e la decisione vera resta al server, che
 * a regalo finito risponde 402 regalo_finito (gestito in apiFetch, e domani
 * dal muro della quota). Recap e pattern restano del gradino premium
 * (SPEC par. 2). Tutto questo vale SOLO con l'interruttore acceso
 * (ospite/flag.ts): spento, il locale resta a zero AI come prima.
 */
function ospitePuo(c: Capability): boolean {
  return (c === "voice" || c === "aiSummary") && ospiteAttivo();
}

/**
 * IL PREMIUM SUL DISPOSITIVO (mockup premium-senza-password, B1): l'ospite
 * che ha comprato con il foglio di Apple senza mettere una email. Tutto
 * tranne `sync`, che vuole un account per definizione.
 */
function dispositivoPremiumPuo(c: Capability): boolean {
  return c !== "sync" && premiumDispositivo();
}

export type Capability = "voice" | "aiSummary" | "recap" | "patterns" | "sync";

export function can(c: Capability): boolean {
  if (getStore().mode !== "cloud") {
    return getStore().mode === "local" && (ospitePuo(c) || dispositivoPremiumPuo(c));
  }
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
  const premiumSulDispositivo = usePremiumDispositivo();
  // Stessa semantica di can(): finche la modalita non e risolta risponde
  // il ramo cloud (le schermate dati stanno comunque dietro AuthGate).
  if (mode === "local") return ospitePuo(c) || (c !== "sync" && premiumSulDispositivo);
  if (c === "sync") return true;
  return plan === "premium";
}
