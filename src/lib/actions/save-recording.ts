"use client";

/**
 * L'orchestrazione di una registrazione (o di un testo scritto a mano):
 * split per data -> elaborazione AI -> salvataggio via store.
 *
 * Vive QUI e non nello store (SPEC-v2 §2.2): non e accesso ai dati, e
 * orchestrazione che chiama /api/*. Se stesse dentro JournalStore,
 * LocalStore dovrebbe implementarla con un throw e la promessa "in locale
 * nemmeno una richiesta di rete" dipenderebbe dal fatto che per caso
 * nessuno la chiami. can("aiSummary") si controlla PRIMA di partire.
 *
 * Il comportamento e identico a quando viveva in src/lib/data/entries.ts:
 * se l'AI fallisce, la giornata si salva LO STESSO col testo grezzo — quel
 * comportamento non va perso (spec §7.3).
 *
 * L'analisi vera (titolo, sintesi, aree, persone) sta in
 * src/lib/actions/analyze-day.ts e gira SEMPRE sul testo completo del
 * giorno: qui si costruisce quel testo e si sceglie la data, niente altro.
 */

import { apiFetch } from "@/lib/api";
import { can } from "@/lib/capabilities";
import { getStore } from "@/lib/data/store";
import { invalidateAll } from "@/lib/data/cache";
import { analyzeDay, localFields } from "@/lib/actions/analyze-day";
import type { AreaSummary, Entry } from "@/lib/types";

export type RecordingInput = {
  transcript: string;
  durationSeconds: number;
  /** Default date for segments without explicit temporal markers (YYYY-MM-DD). */
  defaultDate: string;
  /**
   * "Salva e basta" (Cmd+S, SPEC-v2 §5.4): salva il testo cosi com'e anche
   * quando l'AI sarebbe disponibile. La prima riga diventa il titolo
   * (localFields), zero chiamate a /api.
   */
  skipAI?: boolean;
  /**
   * NON dividere il testo per data. Serve quando la giornata l'ha scelta
   * l'utente aprendo /giorno: li lo split e attivamente dannoso, perche
   * una frase come "ieri sono andato in palestra" sposta il testo su un
   * altro giorno e sulla schermata aperta non compare niente. E successo
   * davvero il 21 agosto 2026: il testo era stato salvato — sul giorno
   * sbagliato — e da fuori sembrava perso.
   *
   * Su Oggi lo split resta: li la data non l'hai scelta tu, e raccontare
   * "ieri sera" mentre registri stamattina e la norma.
   */
  skipSplit?: boolean;
  /**
   * Chiamata APPENA l'analisi di un segmento e pronta, PRIMA delle
   * scritture sul database (2 settembre 2026, richiesta di Manuel: "questa
   * parte impiega fino a un minuto, scopri se si puo velocizzare").
   *
   * Serve a una cosa sola: far partire i chiarimenti (la chiamata AI piu
   * lenta di tutte, 16-21 s misurati) senza aspettare che la giornata, le
   * misure e i fatti siano scritti. Le domande dipendono dal testo, dalle
   * persone e dalle aree — cioe da cio che l'analisi ha appena detto — e
   * non dal fatto che la riga sia gia nel database. Chi ascolta riceve
   * esattamente cio che verra salvato.
   */
  onAnalisi?: (analisi: {
    date: string;
    transcript: string;
    people: string[];
    areas: AreaSummary[];
  }) => void;
};

const SEGMENT_SEP = "\n---\n";

type DateSegment = { date: string; text: string };

async function callSplitByDate(
  transcript: string,
  defaultDate: string,
): Promise<DateSegment[]> {
  try {
    const resp = await apiFetch("/api/split-by-date", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript, defaultDate }),
    });
    if (!resp.ok) return [{ date: defaultDate, text: transcript }];
    const data = (await resp.json()) as { segments?: DateSegment[] };
    if (!data.segments || data.segments.length === 0) {
      return [{ date: defaultDate, text: transcript }];
    }
    return data.segments;
  } catch {
    return [{ date: defaultDate, text: transcript }];
  }
}

/** Il testo completo del giorno: cio che c'era piu il pezzo nuovo. */
function testoCompleto(existing: Entry | null, pezzo: string): string {
  return existing?.transcript
    ? existing.transcript + SEGMENT_SEP + pezzo.trim()
    : pezzo.trim();
}

export async function saveRecording(input: RecordingInput): Promise<Entry[]> {
  const store = getStore();
  const useAI = can("aiSummary") && !input.skipAI;
  const conSplit = useAI && !input.skipSplit;

  /* LO SPLIT E L'ANALISI PARTONO INSIEME (2 settembre 2026). Prima
     andavano in fila: 3,6 s per sapere se il racconto parla di piu giorni,
     e SOLO DOPO l'analisi (~10 s). Ma nel caso normale — un racconto, un
     giorno — lo split risponde "e tutto di oggi" e l'analisi sarebbe
     partita comunque sullo stesso identico testo. Quindi si scommette:
     l'analisi del caso "un giorno solo" parte subito, in parallelo; se lo
     split conferma (un segmento, la data di oggi — e il server, in quel
     caso, restituisce le parole originali, vedi split-by-date.ts) si usa
     quella; altrimenti si butta e si rifa per segmento, come prima. La
     scommessa persa costa un'analisi in piu; vinta, regala 3-4 secondi a
     chi sta guardando una rotella. */
  const scommessa = conSplit
    ? (async () => {
        const existing = await store.loadEntryForDate(input.defaultDate);
        const fullTranscript = testoCompleto(existing, input.transcript);
        const ai = await analyzeDay(fullTranscript);
        return { existing, fullTranscript, ai };
      })()
    : null;
  // Una scommessa persa non deve far esplodere niente: si ignora e basta.
  scommessa?.catch(() => undefined);

  const segments = conSplit
    ? await callSplitByDate(input.transcript, input.defaultDate)
    : [{ date: input.defaultDate, text: input.transcript }];

  const saved: Entry[] = [];
  for (const seg of segments) {
    const vinta =
      scommessa !== null &&
      segments.length === 1 &&
      seg.date === input.defaultDate &&
      seg.text.trim() === input.transcript.trim()
        ? await scommessa.catch(() => null)
        : null;
    const existing = vinta
      ? vinta.existing
      : await store.loadEntryForDate(seg.date);
    const fullTranscript = vinta
      ? vinta.fullTranscript
      : testoCompleto(existing, seg.text);
    // Da zero, su TUTTO il testo del giorno: titolo, sintesi, aree e
    // persone escono dalla stessa lettura dello stesso testo. Vedi
    // src/lib/actions/analyze-day.ts.
    const ai = vinta
      ? vinta.ai
      : useAI
        ? await analyzeDay(fullTranscript)
        : localFields(fullTranscript);
    if (useAI && input.onAnalisi) {
      input.onAnalisi({
        date: seg.date,
        transcript: fullTranscript,
        people: ai.people ?? [],
        areas: ai.areas ?? [],
      });
    }
    const dur = seg.date === input.defaultDate ? input.durationSeconds : 0;
    let entry = await store.saveProcessedEntry(seg.date, fullTranscript, ai, dur);
    // Le misure dette a voce (peso, ore di sonno, umore al risveglio:
    // AIFields.metrics) compilano i campi da sole. Il patch contiene SOLO
    // cio che il testo ha detto: il resto dei campi non viene toccato.
    if (ai.metrics) {
      try {
        entry = await store.updateMetric(seg.date, ai.metrics);
      } catch {
        // Le misure sono un di piu: se non si scrivono, la giornata resta.
      }
    }
    // I fatti vanno scritti DOPO la giornata: hanno bisogno del suo id per
    // sparire insieme a lei. `undefined` significa "non letti" e non tocca
    // niente; una lista vuota e una risposta vera ("qui non c'e nessun
    // fatto") e ha il diritto di svuotare.
    if (ai.facts) {
      try {
        await store.replaceAiFacts(seg.date, ai.facts);
      } catch {
        // I fatti sono un di piu: se non si salvano, la giornata resta.
      }
    }
    saved.push(entry);
  }
  // La cache delle letture non sa niente di questa scrittura: senza,
  // tornando su Mese si vedrebbe ancora il mese di prima.
  invalidateAll();
  return saved;
}

/**
 * Modifica manuale del transcript di una giornata: stessa pipeline AI di una
 * registrazione (il titolo e la sintesi si rigenerano sul testo corretto),
 * poi salvataggio via store. Era `updateEntryTranscript` dentro entries.ts.
 */
export async function reprocessEntryTranscript(
  dateISO: string,
  newTranscript: string,
): Promise<Entry> {
  const store = getStore();
  const ai = can("aiSummary")
    ? await analyzeDay(newTranscript)
    : localFields(newTranscript);
  let saved = await store.saveProcessedEntry(dateISO, newTranscript, ai, 0);
  if (ai.metrics) {
    try {
      saved = await store.updateMetric(dateISO, ai.metrics);
    } catch {
      // vedi saveRecording: le misure non possono far fallire un salvataggio
    }
  }
  if (ai.facts) {
    try {
      await store.replaceAiFacts(dateISO, ai.facts);
    } catch {
      // vedi saveRecording: i fatti non possono far fallire un salvataggio
    }
  }
  invalidateAll();
  return saved;
}
