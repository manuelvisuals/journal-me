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
import { pianoEffettivo } from "@/lib/piano";

export type Plan = "free" | "premium";

const KEY = "jm.plan";

let plan: Plan | null = null;
/**
 * Il dettaglio dell'abbonamento (da dove viene, quando scade), solo in
 * memoria: serve alla riga "Piano" di Impostazioni e alle righe di Apple
 * ("Gestisci abbonamento" ha senso solo se il premium e di Apple).
 */
export type DettaglioPiano = { source: string | null; periodEnd: string | null };
let dettaglio: DettaglioPiano = { source: null, periodEnd: null };
let refreshStarted = false;
/**
 * Quando e stato fatto l'ultimo tentativo ANDATO A VUOTO (modalita non
 * ancora cloud, o sessione non ancora in piedi). Serve solo a non
 * riprovare a ogni render: il tentativo a vuoto NON deve lasciare il
 * lucchetto chiuso per sempre, ma nemmeno diventare un martello.
 */
let ultimoTentativoVuoto = 0;
const ATTESA_RITENTATIVO_MS = 1500;
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
  dettaglio = { source: null, periodEnd: null };
  refreshStarted = false;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // niente da rimuovere
  }
  emit();
}

/**
 * IL TENTATIVO A VUOTO NON CHIUDE LA PORTA (bug del 10 settembre 2026).
 *
 * `refreshStarted` si alzava PRIMA di sapere se il piano si poteva davvero
 * leggere, e sui due ritorni anticipati (modalita non cloud, nessuna
 * sessione) restava alzato per sempre. Al primo avvio l'app parte ospite,
 * qualcuno chiede il piano, il tentativo torna a vuoto — e da quel momento
 * `profiles` non si legge PIU per tutta la vita della pagina, login
 * compreso. Conseguenza misurata sul telefono di Manuel: un account
 * premium (appreview@dayalogue.com, premium dall'8 settembre) e rimasto
 * "piano sconosciuto" dopo l'accesso, /benvenuto non e entrata da sola
 * come fa con i premium, e 45 secondi dopo il login l'app gli ha venduto
 * un abbonamento che aveva gia.
 *
 * Adesso il tentativo a vuoto si annota e si puo ripetere, con un'attesa
 * breve in mezzo perche getPlanSync() viene chiamata a ogni render.
 */
async function refreshPlan(): Promise<void> {
  if (refreshStarted) return;
  if (Date.now() - ultimoTentativoVuoto < ATTESA_RITENTATIVO_MS) return;
  refreshStarted = true;
  const aVuoto = () => {
    refreshStarted = false;
    ultimoTentativoVuoto = Date.now();
  };
  // MAI in locale: si aspetta la risoluzione della modalita (sincrona nel
  // ramo locale) e il client Supabase non si costruisce nemmeno — la
  // promessa zero-rete della PR 3 vale anche qui.
  const mode = await resolveStorageMode();
  if (mode !== "cloud") {
    aVuoto();
    return;
  }
  try {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      aVuoto();
      return;
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan, plan_source, current_period_end")
      .eq("user_id", user.id)
      .maybeSingle();
    dettaglio = {
      source: (profile?.plan_source as string | null | undefined) ?? null,
      periodEnd: (profile?.current_period_end as string | null | undefined) ?? null,
    };
    // Scadenza compresa (src/lib/piano.ts): un premium scaduto mostra i
    // lucchetti, come il server gli rispondera 402.
    setPlan(pianoEffettivo(profile));
  } catch {
    // Rete giu o env mancanti: resta la cache (o l'ottimismo), ma il
    // prossimo giro deve poter riprovare — vedi il commento sopra.
    aVuoto();
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

/**
 * Il piano quando e NOTO davvero (cache locale o database), SENZA
 * l'ottimismo di usePlan: null = "non lo so ancora".
 *
 * Serve a chi deve trattare i premium diversamente dai gratis e non puo
 * permettersi di scambiare "non lo so" per "premium": /benvenuto, che
 * dal 27 agosto entra da sola per i premium — con l'ottimismo entrerebbe
 * da sola per TUTTI, e la scelta non si vedrebbe mai.
 */
export function usePianoNoto(): Plan | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => {
      const c = readCache();
      void refreshPlan();
      return c;
    },
    () => null,
  );
}

/** Da dove viene il premium e quando scade (null = non lo so / non scade). */
export function useDettaglioPiano(): DettaglioPiano {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => dettaglio,
    () => dettaglio,
  );
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
