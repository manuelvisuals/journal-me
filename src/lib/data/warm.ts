"use client";

/**
 * Il precaricamento: mentre guardi la prima schermata, in sottofondo
 * arrivano i dati delle altre.
 *
 * Richiesta di Manuel del 21 agosto 2026: "passare da una schermata
 * all'altra e lentissimo, precarica tutto in background". Ha ragione sul
 * sintomo — ogni tab apre le sue query e in cloud ognuna e un giro fino a
 * Supabase — e la cura e questa, insieme alla cache di cache.ts.
 *
 * QUANDO. Dopo che la prima schermata ha finito di caricarsi, non prima:
 * partire subito significherebbe mettere in coda cinque richieste davanti a
 * quella che l'utente sta aspettando davvero, e la prima schermata
 * diventerebbe piu lenta per rendere piu veloci quelle che forse non
 * aprira. Si aspetta `signalReady()` — lo stesso segnale che toglie la
 * splash — e in piu un attimo di respiro.
 *
 * COSA. Le quattro letture che servono agli altri tab: il mese corrente
 * (Mese), i micro-goal (Oggi e Impostazioni), Ricorda, i recap. Non le
 * giornate passate una per una: sono infinite e non si sa quale aprira.
 *
 * COSA NON FA. Non tocca niente se la modalita non e ancora risolta, non
 * riprova in caso di errore e non dice niente all'utente: e un lusso, non
 * una funzione. Se fallisce, la schermata che lo scopre carica come ha
 * sempre fatto.
 */

import { loadGoalDefs } from "@/lib/data/goals";
import { loadMonthEntries } from "@/lib/data/entries";
import { loadRecaps } from "@/lib/data/recaps";
import { loadRemembers } from "@/lib/data/remembers";
import { resolveStorageMode } from "@/lib/data/store";
import { nowAppParts } from "@/lib/format";

let started = false;

/** Precarica una volta sola per sessione. Chiamarla piu volte non fa nulla. */
export async function warmAll(): Promise<void> {
  if (started) return;
  started = true;
  try {
    const mode = await resolveStorageMode();
    if (mode !== "local" && mode !== "cloud") return;
    const { year, month } = nowAppParts();
    // Tutte insieme: sono indipendenti, e in serie sommerebbero le latenze.
    await Promise.allSettled([
      loadGoalDefs(),
      loadMonthEntries("auth", year, month),
      loadRemembers("auth"),
      loadRecaps("auth"),
    ]);
  } catch {
    // Il precaricamento non ha diritto di rompere niente.
  }
}
