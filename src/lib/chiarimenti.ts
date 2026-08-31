"use client";

/**
 * Le domande che l'AI fa invece di indovinare, e cosa succede quando rispondi.
 *
 * La regola e di Manuel, 23 agosto 2026: "l'AI non deve MAI indovinare".
 * Il perche, e la distinzione fra le due specie di domanda, stanno in
 * src/app/api/chiarimenti/route.ts. Qui c'e solo la meta client: chiedere le
 * domande, e APPLICARE le risposte.
 *
 * Le tre azioni possibili, e non ce ne sono altre:
 *
 *   persona   "mio fratello" e Daniele. Diventa un soprannome permanente:
 *             vale da subito su tutte le giornate, comprese quelle di marzo,
 *             e il racconto non viene toccato.
 *   specie    "da Charlie" non e una persona, e un posto. Anche questo
 *             permanente: da adesso sparisce dalle persone ovunque.
 *   area      La piscina di OGGI era stare con gli amici. Vale solo per
 *             questa giornata, e si riscrive solo l'elenco delle aree.
 *
 * E la quarta possibilita, che e una risposta e non una scappatoia:
 *
 *   non so    La cosa resta SENZA area. Se l'AI non deve mai indovinare, non
 *             deve farlo nemmeno al posto tuo quando salti la domanda. Un
 *             buco onesto e meglio di un dato inventato: fra sei mesi
 *             rileggeresti statistiche che non sono le tue.
 *
 * E la quinta (Manuel, 27 agosto 2026, dopo "repairing the scooter tire"):
 *
 *   non c'entra   La cosa NON appartiene a nessuna sfera: riparare una gomma
 *                 non e movimento ne lavoro, e solo una cosa fatta. E una
 *                 risposta vera: chiude la domanda per sempre e non tocca
 *                 le aree della giornata.
 */

import { apiFetch } from "@/lib/api";
import { chiaveAlias } from "@/lib/aliases";
import {
  saveAlias,
  loadAliases,
  loadOpenQuestions,
  saveOpenQuestions,
  answerQuestion,
} from "@/lib/data/facts";
import { loadPersonaNames } from "@/lib/data/remembers";
import { saveAreas } from "@/lib/data/entries";
import type { DataMode } from "@/lib/data/entries";
import { spostaFraAree } from "@/lib/chiarimenti-aree";
import type { AreaSummary, Domanda, Entry, FactKind, Opzione } from "@/lib/types";

export { spostaFraAree };
export type { Domanda, Opzione };

/** Il valore scelto, oppure null = "non saprei" (che e una risposta). */
/**
 * La risposta a una domanda.
 *
 * `valore` null vuol dire SALTATA, e saltare significa "non adesso": la
 * domanda resta in coda e torna alla prossima analisi. Non esiste piu un
 * modo per liberarsene senza rispondere (regola di Manuel, 23 agosto 2026) —
 * l'unica uscita onesta per una cosa che non e una persona e il bottone che
 * lo dice.
 */
/**
 * `valori` esiste dal 31 agosto 2026, per le domande sulle persone: "i miei
 * amici" possono essere due, e sceglierne uno solo sarebbe rispondere il
 * falso. Quando c'e, e lui che comanda; `valore` resta la stessa risposta
 * scritta in una riga, ed e cio che si registra nella coda per dire che la
 * domanda e chiusa.
 */
export type Risposta = {
  domanda: Domanda;
  valore: string | null;
  valori?: string[];
  nomeVero?: string;
};

/**
 * Il valore dell'opzione "non e una persona".
 *
 * Si scrive come soprannome SENZA nome vero (vedi src/lib/aliases.ts): da
 * quel momento quella parola non compare piu fra le persone, in nessuna
 * giornata. Non serviva una tabella nuova.
 */
export const NON_E_UNA_PERSONA = "__nessuno__";

/**
 * Il valore dell'opzione "non c'entra con nessuna sfera" (domande di area).
 *
 * E una risposta piena: passa da answerQuestion e la domanda non torna piu.
 * Non sposta niente fra le aree — il punto e proprio che quella cosa non ne
 * merita una.
 */
export const NON_APPARTIENE = "__nessuna_sfera__";

/**
 * Chiede all'AI cosa non ha capito. Se qualcosa va storto torna un elenco
 * vuoto: un dubbio non chiarito e un peccato, una giornata che non si salva
 * per colpa di un dubbio e un danno.
 */
async function generaDomande(
  mode: DataMode,
  transcript: string,
  contesto: { people?: string[]; areas?: AreaSummary[] },
): Promise<Domanda[]> {
  try {
    const [roster, aliases] = await Promise.all([
      loadPersonaNames(mode).catch(() => [] as string[]),
      loadAliases(mode).catch(() => []),
    ]);
    const resp = await apiFetch("/api/chiarimenti", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transcript,
        roster,
        aliases,
        people: contesto.people ?? [],
        areas: contesto.areas ?? [],
      }),
    });
    if (!resp.ok) return [];
    const data = (await resp.json()) as { domande?: Domanda[] };
    return Array.isArray(data.domande) ? data.domande : [];
  } catch {
    return [];
  }
}

/**
 * Analizzata una giornata, cosa c'e da chiedere — di QUELLA giornata e di
 * tutte le altre.
 *
 * La regola e di Manuel, 23 agosto 2026: "appena l'AI elabora roba, se ha
 * domande anche vecchie le fa sempre all'utente, e le richiede a sfinimento
 * finche non risponde a tutto". Quindi:
 *
 *   1. si chiede al modello cosa non ha capito di questa giornata;
 *   2. quei dubbi si mettono in coda (le risposte gia date non si riaprono);
 *   3. si torna TUTTA la coda, non solo la parte nuova.
 *
 * L'arretrato non e un caso di ripiego: e la strada normale per chi scrive
 * gratis per un mese e poi passa a premium, e si ritrova un archivio che
 * nessuno ha mai letto.
 */
export async function chiediChiarimenti(
  mode: DataMode,
  dateISO: string,
  transcript: string,
  contesto: { people?: string[]; areas?: AreaSummary[] },
): Promise<Domanda[]> {
  const nuove = await generaDomande(mode, transcript, contesto);
  try {
    await saveOpenQuestions(mode, dateISO, nuove);
  } catch {
    // La coda non si e scritta: si chiedono almeno quelle di adesso, invece
    // di non chiedere niente.
    return nuove;
  }
  try {
    return await loadOpenQuestions(mode);
  } catch {
    return nuove;
  }
}

/**
 * "Basta per adesso" mette in pausa fino alla prossima apertura dell'app,
 * non di piu — e cio che promette il tasto, ed e il massimo che si puo
 * concedere senza tradire la regola: nessuna domanda si perde, si rimanda.
 *
 * Vive in sessionStorage e non in localStorage di proposito: muore con la
 * scheda. Riaprire il diario domani vuol dire ritrovarsele.
 */
const PAUSA = "jm:domande-pausa";

export function metteInPausa(): void {
  try {
    window.sessionStorage.setItem(PAUSA, "1");
  } catch {
    // storage negato: le domande ricompariranno prima. Pazienza.
  }
}

export function bastaPerOra(): boolean {
  try {
    return window.sessionStorage.getItem(PAUSA) === "1";
  } catch {
    return false;
  }
}

/** Solo la coda, senza analizzare niente. La usa chi arriva su una giornata. */
export async function domandeInSospeso(mode: DataMode): Promise<Domanda[]> {
  try {
    return await loadOpenQuestions(mode);
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ aree */

const SPECIE_VALIDE: FactKind[] = [
  "cibo",
  "attivita",
  "persona",
  "lavoro",
  "luogo",
];

/* -------------------------------------------------------------- applicare */

/**
 * Le chiavi su cui scrivere il soprannome: quella della domanda, piu ogni
 * nome della giornata che indica la stessa persona.
 *
 * "Mio fratello" e "fratello" sono la stessa persona detta in due modi, e
 * l'app li incontra tutti e due: l'uno nella domanda, l'altro nell'elenco
 * salvato. Scrivere il soprannome su una sola delle due chiavi vuol dire
 * rispondere e non vedere cambiare niente.
 *
 * Il confronto e per contenimento e non per uguaglianza, ma solo in una
 * direzione e con un pavimento di tre lettere: cosi "fratello" dentro "mio
 * fratello" si aggancia, e "Ida" dentro "Guida turistica" no.
 */
/**
 * Segna una domanda come decisa, cosi non torna piu.
 *
 * Solo le RISPOSTE chiudono. Una domanda saltata non passa mai di qui, ed e
 * il motivo per cui torna.
 */
async function chiudi(mode: DataMode, domanda: Domanda, valore: string) {
  try {
    await answerQuestion(mode, domanda.id, valore);
  } catch {
    // Non si e chiusa: la ritroverai. E il verso giusto in cui sbagliare.
  }
}

/**
 * I nomi scelti, uno o piu.
 *
 * `valori` e la strada normale da quando la domanda sulle persone accetta
 * piu risposte; `valore` resta per le risposte scritte a mano nel campo
 * libero, che sono un nome solo per costruzione. Doppioni tolti: toccare due
 * volte lo stesso bottone non deve scrivere due volte lo stesso nome.
 */
function nomiScelti(r: Risposta): string[] {
  const grezzi = r.valori && r.valori.length > 0 ? r.valori : [r.valore ?? ""];
  const visti = new Set<string>();
  const fuori: string[] = [];
  for (const g of grezzi) {
    const n = g.trim();
    if (!n) continue;
    const k = chiaveAlias(n);
    if (visti.has(k)) continue;
    visti.add(k);
    fuori.push(n);
  }
  return fuori;
}

function formeDelSoggetto(soggetto: string, personeDelGiorno: string[]): string[] {
  const base = chiaveAlias(soggetto);
  const forme = new Set<string>();
  if (base) forme.add(base);
  for (const p of personeDelGiorno) {
    const k = chiaveAlias(p);
    if (k.length >= 3 && base.includes(k)) forme.add(k);
  }
  return [...forme];
}

/**
 * Applica tutte le risposte. Torna la giornata aggiornata se le aree sono
 * cambiate, altrimenti quella che aveva ricevuto.
 *
 * I soprannomi si scrivono anche quando la giornata non cambia: valgono per
 * sempre e su tutto lo storico, non su questo salvataggio.
 */
export async function applicaRisposte(
  mode: DataMode,
  dateISO: string,
  entry: Entry | null,
  risposte: Risposta[],
): Promise<Entry | null> {
  let aree = entry?.areas ? [...entry.areas] : [];
  let areeCambiate = false;

  for (const r of risposte) {
    const { domanda, valore } = r;

    if (domanda.azione === "persona") {
      // Saltata: non si scrive niente e la domanda resta aperta.
      if (!valore) continue;
      if (valore === NON_E_UNA_PERSONA) {
        for (const forma of formeDelSoggetto(domanda.soggetto, entry?.people ?? [])) {
          await saveAlias(mode, { kind: "persona", alias: forma, labelKeys: [] });
        }
        await chiudi(mode, domanda, valore);
        continue;
      }
      // Uno o piu nomi: "i miei amici" possono essere Hoda e Liana. Il
      // soprannome resta uno — la parola che hai detto tu — e sono le
      // persone dietro a essere due.
      const nomi = nomiScelti(r);
      if (nomi.length === 0) continue;
      // TUTTE le grafie che quel giorno indicavano quella persona, non solo
      // quella della domanda. Visto in produzione il 23 agosto: la domanda
      // diceva "mio fratello" mentre la giornata aveva salvato "fratello", e
      // il soprannome finiva su una chiave che non compariva da nessuna
      // parte. La persona restava "fratello" anche dopo aver risposto.
      for (const forma of formeDelSoggetto(domanda.soggetto, entry?.people ?? [])) {
        await saveAlias(mode, { kind: "persona", alias: forma, labelKeys: nomi });
      }
      await chiudi(mode, domanda, valore);
      continue;
    }

    if (domanda.azione === "specie") {
      if (!valore) continue;
      const kind = SPECIE_VALIDE.includes(valore as FactKind)
        ? (valore as FactKind)
        : null;
      if (!kind) continue;
      const nome = (r.nomeVero ?? "").trim() || domanda.soggetto.trim();
      await saveAlias(mode, {
        kind,
        alias: chiaveAlias(domanda.soggetto),
        labelKeys: [nome],
      });
      await chiudi(mode, domanda, valore);
      continue;
    }

    // azione === "area": solo questa giornata.
    if (!valore) continue;
    // "Non c'entra con nessuna sfera": la domanda si chiude per sempre e le
    // aree restano come sono. Vedi NON_APPARTIENE qui sopra.
    if (valore === NON_APPARTIENE) {
      await chiudi(mode, domanda, valore);
      continue;
    }
    const candidate = domanda.opzioni
      .flatMap((o) => o.valore.split("+"))
      .map((v) => v.trim())
      .filter(Boolean);
    const scelte = valore
      ? valore.split("+").map((v) => v.trim()).filter(Boolean)
      : [];
    const prima = JSON.stringify(aree);
    aree = spostaFraAree(aree, domanda.soggetto, scelte, candidate);
    if (JSON.stringify(aree) !== prima) areeCambiate = true;
    await chiudi(mode, domanda, valore);
  }

  if (!areeCambiate || !entry) return entry;
  try {
    return await saveAreas(mode, dateISO, aree);
  } catch {
    // Le aree non si sono salvate: i soprannomi si, e la giornata c'e.
    return entry;
  }
}
