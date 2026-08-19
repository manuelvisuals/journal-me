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
 * se l'AI fallisce, la giornata si salva LO STESSO col testo grezzo
 * (fallbackAIFields) — quel comportamento non va perso (spec §7.3).
 */

import { apiFetch } from "@/lib/api";
import { can } from "@/lib/capabilities";
import { getStore, type AIFields } from "@/lib/data/store";
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
};

const SEGMENT_SEP = "\n---\n";

type DateSegment = { date: string; text: string };

function fallbackAIFields(transcript: string): AIFields {
  const firstSentence = transcript.trim().split(/(?<=[.!?])\s/)[0] ?? "";
  return {
    headline: "Giornata raccontata",
    snippet: firstSentence.slice(0, 240),
    areas: [],
  };
}

/**
 * Senza AI (modalita locale) la prima riga di cio che hai scritto diventa il
 * titolo e il resto e il tuo testo, come l'hai lasciato (mockup
 * due-modalita §02). E un diario scritto, e va benissimo.
 */
function localFields(transcript: string): AIFields {
  const firstLine =
    transcript
      .trim()
      .split(/\n/)[0]
      ?.trim()
      .replace(/\s+/g, " ") ?? "";
  const headline =
    firstLine.length > 90 ? `${firstLine.slice(0, 89).trimEnd()}\u2026` : firstLine;
  return {
    headline: headline || "Giornata scritta",
    snippet: "",
    areas: [],
  };
}

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

async function callProcessEntry(transcript: string): Promise<AIFields> {
  try {
    const resp = await apiFetch("/api/process-entry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript }),
    });
    if (!resp.ok) return fallbackAIFields(transcript);
    const data = (await resp.json()) as Partial<AIFields>;
    if (!data.headline || !data.snippet) return fallbackAIFields(transcript);
    return {
      headline: data.headline,
      snippet: data.snippet,
      areas: Array.isArray(data.areas) ? data.areas : [],
    };
  } catch {
    return fallbackAIFields(transcript);
  }
}

export async function saveRecording(input: RecordingInput): Promise<Entry[]> {
  const store = getStore();
  const useAI = can("aiSummary") && !input.skipAI;

  const segments = useAI
    ? await callSplitByDate(input.transcript, input.defaultDate)
    : [{ date: input.defaultDate, text: input.transcript }];

  const saved: Entry[] = [];
  for (const seg of segments) {
    const existing = await store.loadEntryForDate(seg.date);
    const fullTranscript = existing?.transcript
      ? existing.transcript + SEGMENT_SEP + seg.text.trim()
      : seg.text.trim();
    const ai = useAI
      ? await callProcessEntry(fullTranscript)
      : localFields(fullTranscript);
    const dur = seg.date === input.defaultDate ? input.durationSeconds : 0;
    saved.push(await store.saveProcessedEntry(seg.date, fullTranscript, ai, dur));
  }
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
    ? await callProcessEntry(newTranscript)
    : localFields(newTranscript);
  return store.saveProcessedEntry(dateISO, newTranscript, ai, 0);
}
