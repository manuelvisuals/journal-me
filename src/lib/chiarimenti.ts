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
 */

import { apiFetch } from "@/lib/api";
import { chiaveAlias } from "@/lib/aliases";
import { saveAlias, loadAliases } from "@/lib/data/facts";
import { loadPersonaNames } from "@/lib/data/remembers";
import { saveAreas } from "@/lib/data/entries";
import type { DataMode } from "@/lib/data/entries";
import { spostaFraAree } from "@/lib/chiarimenti-aree";
import type { AreaSummary, Entry, FactKind } from "@/lib/types";

export { spostaFraAree };

export type Opzione = {
  valore: string;
  etichetta: string;
  sotto: string;
  /** Solo per azione 'specie': con che nome mostrarla d'ora in poi. */
  nomeVero: string;
};

export type Domanda = {
  id: string;
  /** 'identita' vale per sempre, 'episodio' solo per questa giornata. */
  specie: "identita" | "episodio";
  azione: "persona" | "specie" | "area";
  soggetto: string;
  citazione: string;
  testo: string;
  perche: string;
  opzioni: Opzione[];
  libero: boolean;
};

/** Il valore scelto, oppure null = "non saprei" (che e una risposta). */
export type Risposta = { domanda: Domanda; valore: string | null; nomeVero?: string };

/**
 * Chiede all'AI cosa non ha capito. Se qualcosa va storto torna un elenco
 * vuoto: un dubbio non chiarito e un peccato, una giornata che non si salva
 * per colpa di un dubbio e un danno.
 */
export async function chiediChiarimenti(
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
      // "Non saprei" su un nome non scrive niente: meglio il soprannome che
      // un nome sbagliato inciso per sempre.
      if (!valore) continue;
      const nome = valore.trim();
      // TUTTE le grafie che quel giorno indicavano quella persona, non solo
      // quella della domanda. Visto in produzione il 23 agosto: la domanda
      // diceva "mio fratello" mentre la giornata aveva salvato "fratello", e
      // il soprannome finiva su una chiave che non compariva da nessuna
      // parte. La persona restava "fratello" anche dopo aver risposto.
      for (const forma of formeDelSoggetto(domanda.soggetto, entry?.people ?? [])) {
        await saveAlias(mode, { kind: "persona", alias: forma, labelKey: nome });
      }
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
        labelKey: nome,
      });
      continue;
    }

    // azione === "area": solo questa giornata.
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
  }

  if (!areeCambiate || !entry) return entry;
  try {
    return await saveAreas(mode, dateISO, aree);
  } catch {
    // Le aree non si sono salvate: i soprannomi si, e la giornata c'e.
    return entry;
  }
}
