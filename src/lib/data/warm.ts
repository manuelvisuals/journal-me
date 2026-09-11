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
 * COSA. Prima di tutto LO SPECCHIO (store/specchio.ts, decisione 1C dell'11
 * settembre 2026): la copia cifrata delle giornate sul dispositivo si mette
 * in pari col server, e da quel momento Mese e i giorni passati si leggono
 * dal telefono — niente rete, niente skeleton, anche in aereo. Va per primo
 * perche le letture qui sotto, se lo specchio e pronto, non toccano piu la
 * rete. Poi le quattro letture che servono agli altri tab: il mese corrente
 * (Mese), i micro-goal (Oggi e Impostazioni), Ricorda, i recap. Non le
 * giornate passate una per una: sono infinite e non si sa quale aprira.
 *
 * E POI OGNI VOLTA CHE L'APP TORNA IN PRIMO PIANO: mentre eri altrove puoi
 * aver scritto dall'iPad. La sincronizzazione e un elenco leggero piu le
 * buste cambiate, quindi quasi sempre e una richiesta sola e niente.
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
import { resolveStorageMode, sincronizzaSpecchio } from "@/lib/data/store";
import { avviaCoda } from "@/lib/actions/coda-analisi";
import { nowAppParts } from "@/lib/format";

let started = false;

/** Precarica una volta sola per sessione. Chiamarla piu volte non fa nulla. */
export async function warmAll(): Promise<void> {
  if (started) return;
  started = true;
  try {
    const mode = await resolveStorageMode();
    if (mode !== "local" && mode !== "cloud") return;
    // Lo specchio per primo: se si mette in pari, tutto il resto si legge
    // dal telefono. Se fallisce (niente rete, IndexedDB negato) non cambia
    // niente: le letture vanno in rete come hanno sempre fatto.
    await sincronizzaSpecchio().catch(() => {});
    vedetta();
    // La coda dell'analisi (lib/actions/coda-analisi.ts): se una giornata e
    // rimasta senza titolo e senza aree perche la rete e caduta, il lavoro
    // riparte qui, da solo, senza che la persona debba premere niente.
    avviaCoda();
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

let vedettaMessa = false;

/**
 * La vedetta del ritorno in primo piano. Una sola per sessione, e un solo
 * giro alla volta: se il telefono va e viene tre volte in tre secondi non
 * partono tre sincronizzazioni.
 */
function vedetta(): void {
  if (vedettaMessa || typeof document === "undefined") return;
  vedettaMessa = true;
  let inCorso = false;
  const guarda = () => {
    if (document.visibilityState !== "visible" || inCorso) return;
    inCorso = true;
    void sincronizzaSpecchio()
      .catch(() => {})
      .finally(() => {
        inCorso = false;
      });
  };
  document.addEventListener("visibilitychange", guarda);
}
