"use client";

/**
 * La lettura di TUTTO il diario, quando si passa a premium.
 *
 * Il caso, e non e un caso di ripiego: scrivi gratis per un mese, poi paghi.
 * Quelle trenta giornate non le ha mai lette nessuno — senza AI non c'e
 * analisi, quindi niente sintesi, niente aree, niente persone, e soprattutto
 * nessuna domanda. Il giorno che diventi premium ti ritrovi un archivio
 * muto, ed e il momento peggiore per scoprirlo: hai appena pagato.
 *
 * Regola di Manuel, 23 agosto 2026: "appena uno passa a premium, l'AI parte
 * e scansiona TUTTO il diario, e poi faccia le domande — perche da regola
 * dopo una scansione ci sono le domande".
 *
 * COSA SCANSIONA DAVVERO. "Tutto" alla lettera vorrebbe dire rileggere da
 * capo anche le giornate gia lette: su un diario di trecento giorni sono
 * novecento chiamate per non cambiare niente. Quindi:
 *
 *   - giornata MAI letta (scritta senza AI): analisi completa, poi domande;
 *   - giornata gia letta ma mai interrogata: solo le domande.
 *
 * Il risultato e lo stesso — a fine giro non resta un angolo del diario su
 * cui l'AI non abbia detto la sua — a un terzo del costo.
 *
 * VA PIANO DI PROPOSITO. Una giornata per volta, senza parallelismo: sono
 * chiamate a pagamento verso un servizio che sa mettersi in coda, e nessuno
 * sta aspettando davanti a questa schermata. Meglio due minuti in silenzio
 * che trenta richieste insieme e meta rifiutate.
 */

import { getStore } from "@/lib/data/store";
import { invalidateAll } from "@/lib/data/cache";
import { analyzeDay } from "@/lib/actions/analyze-day";
import { chiediChiarimenti } from "@/lib/chiarimenti";
import type { DataMode } from "@/lib/data/entries";
import type { Entry } from "@/lib/types";

/** Il segno che questo browser l'ha gia fatta. */
const FATTA = "jm:archivio-letto";

export function scansioneGiaFatta(): boolean {
  try {
    return window.localStorage.getItem(FATTA) === "1";
  } catch {
    // Storage negato: si rifara. Rifarla e sprecare qualche chiamata, non
    // rifarla mai e lasciare il diario muto: il verso giusto e questo.
    return false;
  }
}

/**
 * Dimentica di averla fatta. La chiama il logout: il prossimo account che
 * entra da questo browser ha un altro diario, e il suo va letto.
 */
export function dimenticaScansione(): void {
  try {
    window.localStorage.removeItem(FATTA);
  } catch {
    // niente da rimuovere
  }
}

function segnaFatta(): void {
  try {
    window.localStorage.setItem(FATTA, "1");
  } catch {
    // vedi sopra
  }
}

/** Una giornata scritta senza AI: nessuna sintesi e nessuna area. */
function maiLetta(e: Entry): boolean {
  return !e.snippet?.trim() && (e.areas?.length ?? 0) === 0;
}

export type EsitoScansione = {
  /** Giornate rilette da zero. */
  analizzate: number;
  /** Giornate su cui si e solo cercato cosa non era chiaro. */
  interrogate: number;
  /** Domande aperte alla fine, di tutto il diario. */
  domande: number;
};

/**
 * Legge tutto il diario. Torna quante giornate ha toccato e quante domande
 * sono rimaste aperte.
 *
 * `onAvanzamento` serve a dire all'utente che sta succedendo qualcosa: una
 * schermata ferma per due minuti e indistinguibile da una rotta.
 */
export async function scansionaArchivio(
  mode: DataMode,
  onAvanzamento?: (fatte: number, totale: number) => void,
): Promise<EsitoScansione> {
  const store = getStore();
  const entries = await store.loadAllEntries();
  // Dalla piu recente: se qualcosa va storto a meta, e meglio aver sistemato
  // le giornate che l'utente rileggera per prime.
  const daFare = entries
    .filter((e) => e.transcript.trim().length >= 20)
    .sort((a, b) => (a.entryDate < b.entryDate ? 1 : -1));

  let analizzate = 0;
  let interrogate = 0;

  for (let i = 0; i < daFare.length; i++) {
    const e = daFare[i];
    onAvanzamento?.(i, daFare.length);
    try {
      let corrente = e;
      if (maiLetta(e)) {
        const ai = await analyzeDay(e.transcript);
        corrente = await store.saveProcessedEntry(
          e.entryDate,
          e.transcript,
          ai,
          e.durationSeconds,
        );
        if (ai.facts) {
          try {
            await store.replaceAiFacts(e.entryDate, ai.facts);
          } catch {
            // i fatti non fanno fallire una giornata: vedi save-recording
          }
        }
        analizzate += 1;
      }
      // Le domande nascono qui, come dopo ogni analisi. chiediChiarimenti le
      // mette in coda da solo, quindi a fine giro sono tutte li.
      await chiediChiarimenti(mode, corrente.entryDate, corrente.transcript, {
        people: corrente.people ?? [],
        areas: corrente.areas ?? [],
      });
      interrogate += 1;
    } catch {
      // Una giornata che non si lascia leggere non deve fermare le altre
      // trenta. Restera senza analisi, e la prossima volta che la tocchi
      // verra letta come sempre.
    }
  }

  onAvanzamento?.(daFare.length, daFare.length);
  invalidateAll();
  segnaFatta();

  let domande = 0;
  try {
    domande = (await store.loadOpenQuestions()).length;
  } catch {
    // il conto non e il punto
  }
  return { analizzate, interrogate, domande };
}
