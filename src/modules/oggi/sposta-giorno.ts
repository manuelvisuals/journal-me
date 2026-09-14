"use client";

/**
 * Spostare un racconto sul giorno giusto (14 settembre 2026, Manuel: "se
 * quando registro sbaglio la data non posso correggerla"; mockup
 * MOCKUP-sposta-giorno.html, risposte 1B 2C 3C).
 *
 * COSA SI SPOSTA: l'ULTIMO PEZZO, non tutta la giornata (risposta 1B). Un
 * racconto cresce a pezzi — l'app li separa gia con una riga di trattini
 * quando aggiungi due volte nello stesso giorno — e quello sbagliato e
 * sempre l'ultimo, cioe quello appena detto. Portare via tutto il giorno
 * sposterebbe anche il racconto della mattina, che era giusto dov'era.
 *
 * COSA NON SI SPOSTA: foto, peso, sonno, umore, obiettivi. Sono del
 * GIORNO, non del racconto: sulla bilancia ci sei salito il 14, e il 14
 * resta. Si spostano le parole, e basta.
 *
 * L'ORDINE DELLE SCRITTURE NON E CASUALE: prima si scrive il giorno che
 * RICEVE, poi si sistema quello di partenza. Se qualcosa va storto nel
 * mezzo, il pezzo esiste in due posti — brutto ma visibile, e si cancella
 * a mano. All'incontrario sparirebbe, e un racconto perso non si recupera.
 *
 * DUE GIORNI SI RICALCOLANO, non uno: anche quello di partenza, perche il
 * suo titolo e la sua sintesi parlano di un pezzo che li non c'e piu.
 */

import { getStore } from "@/lib/data/store";
import {
  senzaUltimoPezzo,
  testoUnito,
  ultimoPezzo,
} from "@/modules/oggi/pezzi";
import { reprocessEntryTranscript } from "@/lib/actions/save-recording";
import type { Entry } from "@/lib/types";

/** Cosa fare del giorno di partenza quando resta senza una parola. */
export type GiornoVuoto = "cancella" | "lascia";

export type EsitoSposta = {
  /** La giornata che ha ricevuto il pezzo, gia ricalcolata. */
  destinazione: Entry;
  /** La giornata di partenza: ricalcolata, svuotata, o null se cancellata. */
  partenza: Entry | null;
};

/**
 * Sposta l'ultimo pezzo di `da` dentro `a`, e ricalcola tutti e due.
 *
 * `transcript` e il testo che il chiamante ha in mano (quello che si vede
 * nell'editor, comprese le correzioni appena fatte): non si rilegge dal
 * database, o si perderebbero le modifiche non ancora salvate.
 */
export async function spostaUltimoPezzo(opts: {
  da: string;
  a: string;
  transcript: string;
  giornoVuoto: GiornoVuoto;
}): Promise<EsitoSposta> {
  const pezzo = ultimoPezzo(opts.transcript);
  if (pezzo === "") throw new Error("niente da spostare");
  if (opts.da === opts.a) throw new Error("stesso giorno");

  const store = getStore();
  const esistente = await store.loadEntryForDate(opts.a);
  const testoDestinazione = testoUnito(esistente?.transcript ?? "", pezzo);

  // 1. Il giorno che riceve. Prima di tutto: vedi l'ordine, in testa.
  const destinazione = await reprocessEntryTranscript(opts.a, testoDestinazione);

  // 2. Il giorno di partenza.
  const resto = senzaUltimoPezzo(opts.transcript);
  if (resto !== "") {
    const partenza = await reprocessEntryTranscript(opts.da, resto);
    return { destinazione, partenza };
  }
  if (opts.giornoVuoto === "cancella") {
    await store.deleteEntry(opts.da);
    return { destinazione, partenza: null };
  }
  // "Lascia": la giornata resta con le sue foto e le sue misure, e senza
  // racconto. Il testo vuoto passa dalla stessa porta di sempre, cosi
  // titolo, sintesi e aree si svuotano insieme al racconto invece di
  // restare a parlare di qualcosa che non c'e piu.
  const partenza = await store.saveProcessedEntry(
    opts.da,
    "",
    { headline: "", snippet: "", areas: [], people: [] },
    0,
  );
  return { destinazione, partenza };
}
