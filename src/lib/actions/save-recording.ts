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
import type { Entry } from "@/lib/types";

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

export async function saveRecording(input: RecordingInput): Promise<Entry[]> {
  const store = getStore();
  const useAI = can("aiSummary") && !input.skipAI;

  const segments =
    useAI && !input.skipSplit
      ? await callSplitByDate(input.transcript, input.defaultDate)
      : [{ date: input.defaultDate, text: input.transcript }];

  const saved: Entry[] = [];
  for (const seg of segments) {
    const existing = await store.loadEntryForDate(seg.date);
    const fullTranscript = existing?.transcript
      ? existing.transcript + SEGMENT_SEP + seg.text.trim()
      : seg.text.trim();
    // Da zero, su TUTTO il testo del giorno: titolo, sintesi, aree e
    // persone escono dalla stessa lettura dello stesso testo. Vedi
    // src/lib/actions/analyze-day.ts.
    const ai = useAI
      ? await analyzeDay(fullTranscript)
      : localFields(fullTranscript);
    const dur = seg.date === input.defaultDate ? input.durationSeconds : 0;
    const entry = await store.saveProcessedEntry(seg.date, fullTranscript, ai, dur);
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
  const saved = await store.saveProcessedEntry(dateISO, newTranscript, ai, 0);
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
