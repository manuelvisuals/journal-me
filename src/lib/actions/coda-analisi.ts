"use client";

/**
 * LA CODA DELL'ANALISI: l'AI non fallisce, al massimo tarda.
 *
 * 11 settembre 2026. Manuel apre una giornata scritta a mano e trova
 * "Giornata raccontata" al posto del titolo, la sua prima frase al posto
 * della sintesi, zero aree e zero misure — e nessuno che glielo dica.
 * Dietro c'era questo: `/api/process-entry` non aveva risposto entro il
 * tetto di 15 secondi (4G, funzione fredda), il codice era caduto nel
 * ripiego, e il ripiego SALVAVA quel risultato povero come se fosse la
 * risposta definitiva. Un guasto di rete diventava un fatto permanente,
 * indistinguibile da "l'AI ha deciso di non analizzare".
 *
 * La sua risposta, e la regola che questo file mette in codice: "non deve
 * proprio succedere che l'AI fallisce". Non si puo impedire a una rete di
 * cadere; si puo impedire che la caduta diventi un problema della persona.
 * Il modo e quello di sempre, quando una cosa deve succedere per forza: il
 * lavoro non e una chiamata, e un LAVORO. Si mette in coda sul dispositivo,
 * sopravvive alla chiusura dell'app, e riparte da solo — quando l'app si
 * riapre, quando torna in primo piano, quando torna la rete — finche non
 * riesce. Quando riesce, la giornata si completa da sola: titolo, sintesi,
 * aree, misure, persone. Nessun tasto da premere, nessun avviso da
 * chiudere: la persona non deve fare niente, perche non e stata colpa sua.
 *
 * Cosa NON entra in coda: il 402. Li l'AI non ha fallito, ha detto di no
 * (regalo finito, o serve premium). Riprovare all'infinito un no e la
 * definizione di accanimento.
 *
 * Dove sta il segno "questa giornata e ancora in lavorazione": QUI, nella
 * coda, non dentro la giornata. La coda e del dispositivo che deve finire
 * il lavoro, e la giornata sul server non deve portarsi dietro lo stato di
 * un tentativo fallito su un telefono.
 */

import { useSyncExternalStore } from "react";
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { analizzaGiornata } from "@/lib/actions/analyze-day";
import { getStore } from "@/lib/data/store";
import { invalidateAll } from "@/lib/data/cache";

type Lavoro = {
  giorno: string;
  /** Quanti giri sono gia stati fatti: serve solo a diradare i tentativi. */
  tentativi: number;
  creato: string;
};

interface CodaDB extends DBSchema {
  lavori: { key: string; value: Lavoro };
}

const NOME_DB = "journalme-coda";
let db: Promise<IDBPDatabase<CodaDB>> | null = null;

function apri(): Promise<IDBPDatabase<CodaDB>> {
  if (!db) {
    db = openDB<CodaDB>(NOME_DB, 1, {
      upgrade(d) {
        if (!d.objectStoreNames.contains("lavori")) {
          d.createObjectStore("lavori", { keyPath: "giorno" });
        }
      },
    });
  }
  return db;
}

function disponibile(): boolean {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

/* ---------- chi vuole sapere cosa c'e in coda (le schermate) ---------- */

let inCoda = new Set<string>();
const ascoltatori = new Set<(giorni: Set<string>) => void>();

function annuncia(): void {
  for (const a of ascoltatori) a(new Set(inCoda));
}

/** I giorni ancora da analizzare, per chi disegna. Sincrono: e gia in memoria. */
export function giorniInCoda(): Set<string> {
  return new Set(inCoda);
}

export function suCoda(cb: (giorni: Set<string>) => void): () => void {
  ascoltatori.add(cb);
  return () => ascoltatori.delete(cb);
}

/**
 * Per le schermate: questa giornata e ancora in lavorazione? Serve a NON
 * dire una bugia mentre la coda lavora — "aree non estratte" suona
 * definitivo, e non lo e. Quando la coda finisce, l'avviso sparisce da
 * solo perche la giornata si e completata.
 */
export function useAnalisiInCoda(giorno: string): boolean {
  return useSyncExternalStore(
    (cambia) => suCoda(() => cambia()),
    () => inCoda.has(giorno),
    // Sul server la coda non esiste: false, e nessun disallineamento
    // fra il primo disegno e l'idratazione.
    () => false,
  );
}

async function rileggi(): Promise<Lavoro[]> {
  if (!disponibile()) return [];
  try {
    const lavori = await (await apri()).getAll("lavori");
    inCoda = new Set(lavori.map((l) => l.giorno));
    annuncia();
    return lavori;
  } catch {
    return [];
  }
}

/** Mette (o rimette) in coda l'analisi di un giorno. */
export async function accodaAnalisi(giorno: string): Promise<void> {
  if (!disponibile()) return;
  try {
    const d = await apri();
    const gia = await d.get("lavori", giorno);
    await d.put("lavori", {
      giorno,
      tentativi: gia?.tentativi ?? 0,
      creato: gia?.creato ?? new Date().toISOString(),
    });
    inCoda.add(giorno);
    annuncia();
    // Un lavoro nuovo merita il primo giro subito, non fra cinque minuti.
    attesa = 0;
    if (sveglia !== null && typeof window !== "undefined") {
      window.clearTimeout(sveglia);
      sveglia = null;
    }
    riprovaPiuTardi();
  } catch {
    // Senza IndexedDB non c'e coda: resta il comportamento di prima.
  }
}

async function togli(giorno: string): Promise<void> {
  try {
    await (await apri()).delete("lavori", giorno);
  } catch {
    // niente
  }
  inCoda.delete(giorno);
  annuncia();
}

/* ---------------------------- il lavoro ---------------------------- */

let inCorso = false;
let sveglia: number | null = null;
let attesa = 0;

/**
 * L'ATTESA CHE CRESCE. I tre risvegli (app aperta, primo piano, rete
 * tornata) coprono chi esce e rientra, ma non chi resta dentro l'app a
 * guardare la giornata che non si completa: li nessun evento arriva mai.
 * Quindi finche c'e un lavoro in coda si riprova da soli, diradando: 15
 * secondi, poi 30, 60, due minuti, cinque, e li ci si ferma. Diradare non
 * e pigrizia: e non consumare batteria per scoprire dieci volte al minuto
 * che la rete manca ancora.
 */
const ATTESE = [15_000, 30_000, 60_000, 120_000, 300_000];

function riprovaPiuTardi(): void {
  if (typeof window === "undefined" || sveglia !== null || inCoda.size === 0) return;
  const quanto = ATTESE[Math.min(attesa, ATTESE.length - 1)];
  attesa += 1;
  sveglia = window.setTimeout(() => {
    sveglia = null;
    void lavoraLaCoda();
  }, quanto);
}

/**
 * Un giro di coda. Un lavoro per volta e in fila: due analisi insieme
 * significano due giornate che si contendono la stessa rete lenta che ha
 * gia fatto fallire la prima.
 */
export async function lavoraLaCoda(): Promise<void> {
  if (inCorso || !disponibile()) return;
  inCorso = true;
  try {
    const lavori = await rileggi();
    for (const l of lavori) {
      const store = getStore();
      const entry = await store.loadEntryForDate(l.giorno).catch(() => null);
      // La giornata non c'e piu, o e vuota: non c'e niente da analizzare.
      if (!entry || !entry.transcript?.trim()) {
        await togli(l.giorno);
        continue;
      }
      const { campi, esito } = await analizzaGiornata(entry.transcript, l.giorno);
      if (esito === "guasto") {
        // Ancora niente: si riprova al prossimo risveglio (app in primo
        // piano, rete che torna, app riaperta). Non si insiste qui dentro:
        // martellare una rete che non c'e non la fa tornare.
        try {
          await (await apri()).put("lavori", { ...l, tentativi: l.tentativi + 1 });
        } catch {
          // niente
        }
        continue;
      }
      if (esito === "ok") {
        try {
          await store.saveProcessedEntry(l.giorno, entry.transcript, campi, entry.durationSeconds ?? 0);
          if (campi.metrics) await store.updateMetric(l.giorno, campi.metrics).catch(() => null);
          if (campi.facts) await store.replaceAiFacts(l.giorno, campi.facts).catch(() => null);
          invalidateAll();
          // La schermata aperta ha in mano la versione vecchia: senza
          // questo annuncio la giornata si completerebbe sul dispositivo
          // ma resterebbe scritta male sotto gli occhi di chi guarda,
          // fino al prossimo giro di pagina.
          window.dispatchEvent(new CustomEvent("jm:giornata-analizzata", { detail: { giorno: l.giorno } }));
        } catch {
          // La scrittura e fallita: il lavoro resta in coda.
          continue;
        }
      }
      // "ok" scritto, oppure "negato": in tutti e due i casi il lavoro e
      // finito. Un no non si riprova.
      await togli(l.giorno);
    }
  } finally {
    inCorso = false;
    // Se e riuscito qualcosa si riparte dal primo scalino: la rete e
    // tornata, e un secondo lavoro non deve aspettare cinque minuti.
    if (inCoda.size === 0) attesa = 0;
    riprovaPiuTardi();
  }
}

let avviata = false;

/**
 * Le sveglie della coda: l'app che si apre, l'app che torna in primo piano,
 * la rete che torna — piu l'attesa che cresce, qui sopra, per chi resta
 * dentro l'app e non genera nessun evento.
 *
 * Si chiama da AuthGate, al montaggio, e NON solo dal precaricamento: il
 * precaricamento parte dopo `signalReady()` e si ferma da solo se la
 * modalita non e ancora risolta, e legare a quel filo l'unica cosa che
 * ripara una giornata rotta vuol dire che, il giorno che quel filo si
 * spezza, la giornata resta rotta. Chiamarla due volte non fa niente.
 */
export function avviaCoda(): void {
  if (avviata || typeof window === "undefined") return;
  avviata = true;
  void rileggi().then(() => lavoraLaCoda());
  window.addEventListener("online", () => {
    attesa = 0;
    void lavoraLaCoda();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    attesa = 0;
    void lavoraLaCoda();
  });
}
