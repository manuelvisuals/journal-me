"use client";

/**
 * Il piano dell'account cloud (free/premium), lato client — SOLO per la UI
 * (SPEC-v2 §3.3): mostrare o togliere lucchetti, aprire il muro premium.
 * La decisione vera resta sul server (requirePremium, 401/402).
 *
 * Risoluzione: cache sincrona da localStorage ("jm.plan") per non far
 * lampeggiare i lucchetti a ogni load, refresh in background da
 * profiles.plan. Finche non si sa niente si assume "premium" (ottimista):
 * il caso peggiore e un 402 che apre il muro — mai un premium pagante che
 * vede lucchetti a sproposito. In locale il piano non esiste: non chiamare.
 */

import { useSyncExternalStore } from "react";
import { resolveStorageMode } from "@/lib/data/store";

export type Plan = "free" | "premium";

const KEY = "jm.plan";

let plan: Plan | null = null;
let refreshStarted = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

function readCache(): Plan | null {
  if (plan) return plan;
  try {
    const v = window.localStorage.getItem(KEY);
    if (v === "free" || v === "premium") plan = v;
  } catch {
    // storage negato: si va di solo refresh
  }
  return plan;
}

function setPlan(p: Plan): void {
  plan = p;
  try {
    window.localStorage.setItem(KEY, p);
  } catch {
    // pazienza: la sessione corrente funziona comunque
  }
  emit();
}

/**
 * Scrive il piano adesso, senza aspettare la rilettura dal database.
 *
 * La usa il checkout finto (src/app/checkout-finto/client.tsx): dopo il
 * pagamento la schermata successiva deve essere GIA quella premium. Senza,
 * il popup di congratulazioni comparirebbe sopra un'app ancora bloccata,
 * che e peggio di nessun popup.
 *
 * Non e una scorciatoia per aggirare il server: il piano vero l'ha appena
 * scritto la rotta, questa riga aggiorna solo cio che il browser ricorda.
 */
export function setPlanNow(p: Plan): void {
  setPlan(p);
}

/**
 * Rilegge il piano dal database anche se il refresh e gia stato fatto.
 *
 * `refreshStarted` esiste per non chiedere il piano a ogni montaggio, ma
 * significa anche che dopo un cambio di piano nella stessa sessione la
 * verita nuova non arriverebbe mai fino a un ricaricamento della pagina:
 * era esattamente il "sono premium ma l'app non se ne accorge" da evitare.
 */
export async function forcePlanRefresh(): Promise<void> {
  refreshStarted = false;
  await refreshPlan();
}

/** Da chiamare al logout / cambio account. */
export function clearPlanCache(): void {
  plan = null;
  refreshStarted = false;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // niente da rimuovere
  }
  emit();
}

async function refreshPlan(): Promise<void> {
  if (refreshStarted) return;
  refreshStarted = true;
  // MAI in locale: si aspetta la risoluzione della modalita (sincrona nel
  // ramo locale) e il client Supabase non si costruisce nemmeno — la
  // promessa zero-rete della PR 3 vale anche qui.
  const mode = await resolveStorageMode();
  if (mode !== "cloud") return;
  try {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan")
      .eq("user_id", user.id)
      .maybeSingle();
    setPlan(profile?.plan === "premium" ? "premium" : "free");
  } catch {
    // rete giu o env mancanti: resta la cache (o l'ottimismo)
  }
}

/**
 * Piano corrente, sincrono. Avvia il refresh in background la prima volta.
 * SOLO in modalita cloud: in locale non chiamare (ci pensa can()).
 */
export function getPlanSync(): Plan {
  const cachedPlan = readCache();
  void refreshPlan();
  return cachedPlan ?? "premium";
}

export function usePlan(): Plan {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => getPlanSync(),
    () => "premium" as const,
  );
}
