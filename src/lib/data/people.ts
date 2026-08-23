"use client";

/**
 * Le persone del diario: chi hai visto, quando, e quanto spesso.
 *
 * Da dove vengono i dati: `entries.people`, che l'AI estrae gia oggi da ogni
 * giornata e che finora serviva solo a disegnare le pill nella sezione
 * Social. Non c'e nessuna tabella nuova e nessuna migration: la Scheda
 * Persona e una lettura diversa di cio che c'e gia dal primo giorno.
 *
 * PERCHE SI LEGGE TUTTO. "Quando ho visto Christian l'ultima volta" non e
 * una domanda su un mese: se l'ultima volta e a marzo, cercare solo in
 * agosto risponde "mai", che e la risposta sbagliata detta con sicurezza.
 * Le giornate di una persona sola sono qualche centinaio di righe, e passano
 * dalla stessa cache di tutto il resto (60 secondi), quindi aprire tre schede
 * di fila fa una lettura sola.
 *
 * I NOMI SI CONFRONTANO SENZA MAIUSCOLE E SENZA ACCENTI DECORATIVI, perche
 * l'AI scrive "Christian" oggi e "christian" domani, e due schede separate
 * per la stessa persona sono peggio di nessuna scheda. Quello mostrato e il
 * nome piu recente: se lo correggi in una giornata, la scheda si adegua.
 */

import { cached } from "@/lib/data/cache";
import { getStore } from "@/lib/data/store";
import type { DataMode } from "@/lib/data/entries";
import type { Entry } from "@/lib/types";

export type PersonDay = {
  /** YYYY-MM-DD */
  date: string;
  headline: string | null;
  snippet: string | null;
};

export type PersonCard = {
  /** Il nome come lo mostra l'app: l'ultima grafia usata. */
  name: string;
  /** Quante giornate lo nominano. */
  meetings: number;
  /** La piu recente, YYYY-MM-DD. */
  lastSeen: string | null;
  /** Giorni da allora. 0 = oggi. null se non l'hai mai visto. */
  daysAgo: number | null;
  /** Le giornate, dalla piu recente. */
  days: PersonDay[];
  /**
   * Come va il rapporto: incontri negli ultimi 60 giorni contro i 60
   * precedenti. Non e una pagella, e il dato che serve alla domanda vera
   * ("Christian l'hai visto poco ultimamente").
   */
  trend: "su" | "giu" | "stabile";
  recent: number;
  previous: number;
};

/** Chiave di confronto: due grafie della stessa persona devono coincidere. */
export function personKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

async function allEntries(): Promise<Entry[]> {
  return cached("entries:all", () => getStore().loadAllEntries());
}

function daysBetween(fromISO: string, to: Date): number {
  const [y, m, d] = fromISO.split("-").map(Number);
  const from = new Date(y, (m ?? 1) - 1, d ?? 1);
  const a = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((a.getTime() - from.getTime()) / 86_400_000);
}

/**
 * La scheda di una persona. `null` se quel nome non compare in nessuna
 * giornata: la schermata lo dice, invece di mostrare una scheda vuota che
 * sembra un errore.
 */
export async function loadPersonCard(
  _mode: DataMode,
  name: string,
  today: Date = new Date(),
): Promise<PersonCard | null> {
  const key = personKey(name);
  if (!key) return null;

  const entries = await allEntries();
  const mine = entries.filter((e) =>
    (e.people ?? []).some((p) => personKey(p) === key),
  );
  if (mine.length === 0) return null;

  // Dalla piu recente: e l'ordine in cui la si legge.
  mine.sort((a, b) => (a.entryDate < b.entryDate ? 1 : -1));

  const shownName =
    mine[0].people?.find((p) => personKey(p) === key)?.trim() ?? name.trim();

  const lastSeen = mine[0].entryDate;
  const daysAgo = daysBetween(lastSeen, today);

  const recent = mine.filter((e) => daysBetween(e.entryDate, today) <= 60).length;
  const previous = mine.filter((e) => {
    const d = daysBetween(e.entryDate, today);
    return d > 60 && d <= 120;
  }).length;
  const trend: PersonCard["trend"] =
    recent > previous ? "su" : recent < previous ? "giu" : "stabile";

  return {
    name: shownName,
    meetings: mine.length,
    lastSeen,
    daysAgo,
    days: mine.map((e) => ({
      date: e.entryDate,
      headline: e.headline,
      snippet: e.snippet,
    })),
    trend,
    recent,
    previous,
  };
}
