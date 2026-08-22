"use client";

/**
 * L'analisi di una giornata, sempre da zero, sempre su tutto il testo.
 *
 * LA REGOLA, decisa da Manuel il 21 agosto 2026 dopo il caso di Anna
 * Katereta: "il testo di tutta la giornata e king, e l'AI deve sempre
 * basarsi su esso. Ogni modifica richiama TUTTA l'analisi da zero".
 *
 * Prima non era cosi, e produceva risultati che nessuno si sarebbe
 * aspettato: il riassunto girava sul testo completo, i nomi solo
 * sull'ultimo pezzo aggiunto, e la modifica del testo non rileggeva i nomi
 * affatto. Aggiungevi "colazione con Marco" e poi "pranzo con Francesco", e
 * Marco spariva. Correggevi la frase aggiungendo Giulia, e Giulia non
 * compariva mai.
 *
 * Il modello mentale, adesso, e uno solo e sta in una riga: LA GIORNATA E
 * IL SUO TESTO. Tutto il resto - titolo, sintesi, aree, persone, e domani i
 * fatti (SPEC-fatti.md) - e una funzione di quel testo, ricalcolata
 * ogni volta che il testo cambia. Nessun pezzo di stato sopravvive a una
 * modifica per conto suo.
 *
 * COSTA DI PIU, ed e voluto: la quinta aggiunta a una giornata rilegge
 * anche le prime quattro. Su una giornata (qualche migliaio di caratteri)
 * sono centesimi, e comprano l'unica proprieta che conta: cio che vedi
 * corrisponde sempre a cio che c'e scritto.
 *
 * QUANDO NON GIRA: se il testo non e cambiato. Premere Salva senza aver
 * toccato niente non deve spendere niente (stessa richiesta).
 *
 * LE DUE LETTURE RESTANO DUE CHIAMATE, in parallelo. Accorparle farebbe
 * risparmiare, ma i nomi si estraggono a temperatura bassa e con regole
 * rigide (escludi l'autore, escludi luoghi e aziende) mentre la sintesi
 * deve scrivere prosa: in una chiamata sola la temperatura e una, e a
 * rimetterci sarebbero i nomi.
 */

import { apiFetch } from "@/lib/api";
import { t } from "@/lib/i18n";
import type { AIFields } from "@/lib/data/store";

/** Il riassunto: titolo, sintesi, aree. */
async function callProcessEntry(
  transcript: string,
): Promise<Omit<AIFields, "people"> | null> {
  try {
    const resp = await apiFetch("/api/process-entry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript }),
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as Partial<AIFields>;
    if (!data.headline || !data.snippet) return null;
    return {
      headline: data.headline,
      snippet: data.snippet,
      areas: Array.isArray(data.areas) ? data.areas : [],
    };
  } catch {
    return null;
  }
}

/**
 * I nomi. `null` vuol dire "non lo so" (rete, errore, timeout) ed e diverso
 * da `[]`, che vuol dire "questo testo non nomina nessuno". Solo il secondo
 * ha il diritto di svuotare la lista salvata.
 */
async function callExtractPeople(transcript: string): Promise<string[] | null> {
  try {
    const resp = await apiFetch("/api/extract-people", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript }),
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as { people?: string[] };
    if (!Array.isArray(data.people)) return null;
    return data.people.map((p) => p.trim()).filter((p) => p.length > 0);
  } catch {
    return null;
  }
}

/** Quando l'AI non risponde: si salva comunque, e non si perde il testo. */
function fallbackFields(transcript: string): AIFields {
  const firstSentence = transcript.trim().split(/(?<=[.!?])\s/)[0] ?? "";
  return {
    headline: t("Giornata raccontata"),
    snippet: firstSentence.slice(0, 240),
    areas: [],
    // Non `[]`: una chiamata fallita non sa niente delle persone, e non ha
    // nessun diritto di cancellarle.
    people: undefined,
  };
}

/**
 * Analizza da zero il testo COMPLETO di una giornata.
 *
 * `transcript` deve essere tutto il testo del giorno, non il pezzo appena
 * aggiunto: e il punto di tutta questa storia.
 */
export async function analyzeDay(transcript: string): Promise<AIFields> {
  // In parallelo: sono indipendenti, e in fila sommerebbero le due attese
  // davanti a un utente che sta gia guardando la schermata di elaborazione.
  const [summary, people] = await Promise.all([
    callProcessEntry(transcript),
    callExtractPeople(transcript),
  ]);

  if (!summary) return { ...fallbackFields(transcript), people: people ?? undefined };

  return {
    ...summary,
    people: people ?? undefined,
  };
}

/**
 * Senza AI (modalita locale, o "salva e basta"): la prima riga diventa il
 * titolo e il testo resta il tuo. Le persone non si toccano: qui nessuno le
 * ha lette, e "non lette" non significa "non ci sono".
 */
export function localFields(transcript: string): AIFields {
  const firstLine =
    transcript
      .trim()
      .split(/\n/)[0]
      ?.trim()
      .replace(/\s+/g, " ") ?? "";
  const headline =
    firstLine.length > 90 ? `${firstLine.slice(0, 89).trimEnd()}…` : firstLine;
  return {
    headline: headline || t("Giornata scritta"),
    snippet: "",
    areas: [],
    people: undefined,
  };
}
