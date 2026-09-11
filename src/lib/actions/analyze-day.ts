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
 * fatti (src/modules/oggi/SPEC-fatti.md) - e una funzione di quel testo, ricalcolata
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
import { loadKnownLabels } from "@/lib/data/facts";
import type { AIFields } from "@/lib/data/store";
import type { EntryMetrics, Mood, NewFact } from "@/lib/types";

/** Gli umori validi: l'unico posto client dove si valida cio che torna. */
const UMORI: Mood[] = ["great", "good", "neutral", "low", "bad"];

/**
 * Le misure del risveglio, valide e SOLO quelle dette (vedi AIFields.metrics).
 * Ogni campo si tiene solo se ha la forma giusta: un numero storto o un
 * umore fuori elenco non hanno il diritto di toccare i campi dell'app.
 */
function misureValide(raw: unknown): Partial<EntryMetrics> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const m = raw as Record<string, unknown>;
  const out: Partial<EntryMetrics> = {};
  if (typeof m.weightKg === "number" && m.weightKg > 20 && m.weightKg < 400) {
    out.weightKg = m.weightKg;
  }
  if (
    typeof m.sleepHours === "number" &&
    m.sleepHours > 0 &&
    m.sleepHours <= 24
  ) {
    out.sleepHours = m.sleepHours;
  }
  if (typeof m.mood === "string" && UMORI.includes(m.mood as Mood)) {
    out.mood = m.mood as Mood;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * PERCHE NON HA FUNZIONATO, in una riga sola sulla console (11 settembre
 * 2026). Sul telefono di Manuel l'analisi falliva e non c'era modo di
 * sapere se fosse un 500, un tetto scaduto o una risposta storta: dal di
 * fuori i tre casi erano identici, e senza saperlo non si ripara niente.
 * Non e un messaggio per la persona (quella non deve fare niente: ci pensa
 * la coda): e una riga per il dump di Xcode.
 */
function perche(dove: string, motivo: string): void {
  try {
    console.warn(`[jm] ${dove} non ha risposto: ${motivo}`);
  } catch {
    // una console che non c'e non e un problema
  }
}

/** Il riassunto: titolo, sintesi, aree, misure del risveglio. */
async function callProcessEntry(
  transcript: string,
  giorno?: string,
): Promise<Omit<AIFields, "people"> | null | "negato"> {
  try {
    const resp = await apiFetch("/api/process-entry", {
      method: "POST",
      // Il tetto di 15 secondi di apiFetch era tarato su una rete di casa:
      // in 4G, con una funzione che si sveglia fredda, ci si arriva. E
      // arrivarci voleva dire perdere aree e misure per sempre (11
      // settembre 2026). La schermata di attesa ne prevede 45: tanto vale
      // dare all'analisi tutto il tempo che la persona sta gia aspettando.
      timeoutMs: 45_000,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript }),
      giorno,
    });
    // 402: l'AI non c'e PER SCELTA del server (regalo finito, o serve
    // premium), non per un guasto. La giornata va salvata come una giornata
    // senza AI (titolo = prima riga), non come un'AI che non ha risposto.
    if (resp.status === 402) return "negato";
    if (!resp.ok) {
      perche("process-entry", `HTTP ${resp.status}`);
      return null;
    }
    const data = (await resp.json()) as Partial<AIFields>;
    if (!data.headline || !data.snippet) {
      perche("process-entry", "risposta senza titolo o sintesi");
      return null;
    }
    return {
      headline: data.headline,
      snippet: data.snippet,
      areas: Array.isArray(data.areas) ? data.areas : [],
      metrics: misureValide(data.metrics),
    };
  } catch (e) {
    perche("process-entry", (e as Error)?.name === "AbortError" ? "tetto scaduto (45 s)" : String((e as Error)?.message ?? e));
    return null;
  }
}

/**
 * I FATTI della giornata (src/modules/oggi/SPEC-fatti.md §4).
 *
 * Ha assorbito l'estrazione dei nomi: una persona e un fatto con
 * `kind: 'persona'`. Tenerle su due strade separate voleva dire due prompt,
 * due modelli e due punti dove sbagliare — ed e esattamente dove si
 * sbagliava, il 21 agosto, quando i nomi si leggevano solo sull'ultimo pezzo
 * scritto.
 *
 * `null` vuol dire "non lo so" (rete, errore, timeout) ed e diverso da `[]`,
 * che vuol dire "in questo testo non c'e niente". Solo il secondo ha il
 * diritto di svuotare cio che e salvato.
 *
 * LE ETICHETTE GIA USATE si passano al modello perche le RIUSI: e meta della
 * normalizzazione, ed e misurata (RISULTATI-prova-modelli.md) — senza
 * elenco scrive "panca", con l'elenco scrive "panca piana", e i progressi
 * restano un grafico solo invece di due meta che non si sommano.
 */
async function callExtractFacts(transcript: string, giorno?: string): Promise<NewFact[] | null> {
  let known: string[] = [];
  try {
    known = await loadKnownLabels();
  } catch {
    // Nessuna etichetta nota: si estrae lo stesso, si normalizza peggio.
  }
  try {
    const resp = await apiFetch("/api/extract-facts", {
      method: "POST",
      timeoutMs: 45_000,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript, known }),
      giorno,
    });
    if (!resp.ok) {
      perche("extract-facts", `HTTP ${resp.status}`);
      return null;
    }
    const data = (await resp.json()) as {
      facts?: {
        kind?: string;
        label?: string;
        label_key?: string;
        attrs?: Record<string, unknown>;
        confidence?: number;
      }[];
    };
    if (!Array.isArray(data.facts)) return null;
    const validi: NewFact["kind"][] = [
      "cibo",
      "attivita",
      "persona",
      "lavoro",
      "luogo",
    ];
    return data.facts
      .filter(
        (f): f is Required<typeof f> =>
          typeof f.kind === "string" &&
          validi.includes(f.kind as NewFact["kind"]) &&
          typeof f.label === "string" &&
          f.label.trim().length > 0,
      )
      .map((f) => ({
        kind: f.kind as NewFact["kind"],
        label: f.label.trim(),
        labelKey: (f.label_key || f.label).trim().toLowerCase(),
        attrs: f.attrs && typeof f.attrs === "object" ? f.attrs : {},
        confidence: typeof f.confidence === "number" ? f.confidence : null,
        origin: "ai" as const,
      }));
  } catch (e) {
    perche("extract-facts", (e as Error)?.name === "AbortError" ? "tetto scaduto (45 s)" : String((e as Error)?.message ?? e));
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
    facts: undefined,
  };
}

/**
 * Analizza da zero il testo COMPLETO di una giornata.
 *
 * `transcript` deve essere tutto il testo del giorno, non il pezzo appena
 * aggiunto: e il punto di tutta questa storia.
 */
/**
 * Come e andata la lettura:
 *   ok      il modello ha risposto: titolo, sintesi, aree, misure, persone;
 *   negato  402, cioe l'AI ha detto di NO per scelta (regalo finito, o serve
 *           premium). Non e un guasto e non si riprova;
 *   guasto  rete, tetto scaduto, errore, risposta malformata. E qui che
 *           nasceva il danno: fino all'11 settembre 2026 il guasto veniva
 *           salvato come se fosse un risultato, e la giornata restava senza
 *           aree per sempre. Adesso chi chiama lo sa e mette in coda
 *           (lib/actions/coda-analisi.ts).
 */
export type EsitoAnalisi = "ok" | "negato" | "guasto";

/** Come analyzeDay, ma dice anche COM'E ANDATA. */
export async function analizzaGiornata(
  transcript: string,
  giorno?: string,
): Promise<{ campi: AIFields; esito: EsitoAnalisi }> {
  const [summary, facts] = await Promise.all([
    callProcessEntry(transcript, giorno),
    callExtractFacts(transcript, giorno),
  ]);
  const people = facts
    ? [...new Set(facts.filter((f) => f.kind === "persona").map((f) => f.label))]
    : null;
  const base =
    summary === "negato" ? localFields(transcript) : (summary ?? fallbackFields(transcript));
  const campi: AIFields = {
    ...base,
    people: people ?? undefined,
    facts: facts ?? undefined,
  };
  /* COSA CONTA PER DIRE "FATTO" (corretto l'11 settembre 2026, sul telefono
     di Manuel). Solo il riassunto: titolo, sintesi, aree e misure. I FATTI
     no — `null` li vuol dire "non li ho letti", che non e un danno: la
     giornata resta completa e le persone non si toccano (e la regola di
     `AIFields.people`, che esiste da sempre).
     Prima qui bastava che i fatti mancassero per marcare tutto come guasto,
     e allora la coda non scriveva NEMMENO il titolo buono che aveva in
     mano: la giornata restava "Giornata raccontata" per sempre mentre la
     coda riprovava all'infinito una cosa che era gia riuscita. Un'analisi
     riuscita a meta si scrive per la meta riuscita. */
  const esito: EsitoAnalisi =
    summary === "negato" ? "negato" : summary === null ? "guasto" : "ok";
  return { campi, esito };
}

export async function analyzeDay(transcript: string, giorno?: string): Promise<AIFields> {
  return (await analizzaGiornata(transcript, giorno)).campi;
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
    facts: undefined,
  };
}
