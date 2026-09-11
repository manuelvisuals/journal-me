"use client";

/**
 * LO SPECCHIO: la copia delle giornate sul telefono, cifrata (decisione 1C
 * di Manuel, 11 settembre 2026, dopo "detesto vedere gli skeleton").
 *
 * IL PROBLEMA. Con l'account nel cloud il dispositivo non teneva NIENTE:
 * teneva solo la chiave. Ogni apertura del Mese era una query su Supabase
 * piu una decifratura per ogni giornata; ogni apertura di un giorno era
 * un'altra query, perche il cassetto del mese e quello del giorno erano
 * due chiavi diverse nella cache di cache.ts (60 secondi, in memoria, morta
 * alla chiusura dell'app). Risultato: lo skeleton quasi sempre, e senza
 * rete il diario non esisteva.
 *
 * LA CURA. Il dispositivo tiene una copia delle RIGHE COSI COME STANNO SUL
 * SERVER: la busta cifrata, la versione, le date. Non il contenuto in
 * chiaro. Questo e il punto che tiene in piedi la promessa: cio che si
 * salva qui e illeggibile esattamente quanto cio che sta sul server, e si
 * apre solo con la chiave che il dispositivo ha gia nel portachiavi. Se
 * domani qualcuno legge questo database, legge buste chiuse.
 *
 * LA SINCRONIZZAZIONE, senza tombstone e senza migrazioni. Una query sola
 * chiede l'ELENCO (giorno, v, updated_at: niente buste, quindi pochi byte
 * anche con anni di diario), e da li si sa tutto:
 *   - un giorno che il server non ha piu -> via dallo specchio (cosi una
 *     cancellazione fatta sull'iPad non resta a vivere qui per sempre);
 *   - un giorno con una versione diversa da quella locale -> si scarica la
 *     busta nuova;
 *   - tutti gli altri -> non si toccano, e non costano niente.
 * Le buste si scaricano solo per quello che e cambiato davvero. Non serve
 * una colonna nuova, non serve un trigger, non serve ricordare "l'ultima
 * volta che ho sincronizzato": il confronto e sempre fra due elenchi, e un
 * confronto non puo andare fuori sincrono come farebbe un orologio.
 *
 * DI CHI E LO SPECCHIO. Di un utente solo: il suo id sta nel meta. Se apre
 * l'app un altro account, lo specchio si svuota prima di riempirsi (e il
 * logout lo svuota comunque, `svuotaSpecchio`). Un diario che resta addosso
 * al telefono dopo che la persona e uscita sarebbe il peggiore dei bug.
 *
 * QUANDO E "PRONTO". Solo dopo la prima sincronizzazione completa: finche
 * non lo e, le letture vanno in rete come hanno sempre fatto. Un mezzo
 * specchio che risponde "quel giorno non esiste" mentre in realta non l'ha
 * ancora scaricato sarebbe peggio di uno skeleton: sarebbe una bugia.
 */

import { openDB, type DBSchema, type IDBPDatabase } from "idb";

/** Una riga come sta sul server: la busta e chiusa. */
export type RigaSpecchio = {
  giorno: string;
  v: number;
  busta: string;
  updated_at: string;
  created_at: string;
};

/** L'elenco leggero: quello che basta per sapere cosa e cambiato. */
export type VoceElenco = { giorno: string; v: number };

type Meta = {
  chiave: string;
  valore: string | number | boolean;
};

interface SpecchioDB extends DBSchema {
  cassettine: {
    key: string;
    value: RigaSpecchio;
  };
  meta: {
    key: string;
    value: Meta;
  };
}

const NOME_DB = "journalme-specchio";
const VERSIONE_DB = 1;

let db: Promise<IDBPDatabase<SpecchioDB>> | null = null;

function apri(): Promise<IDBPDatabase<SpecchioDB>> {
  if (!db) {
    db = openDB<SpecchioDB>(NOME_DB, VERSIONE_DB, {
      upgrade(d) {
        if (!d.objectStoreNames.contains("cassettine")) {
          d.createObjectStore("cassettine", { keyPath: "giorno" });
        }
        if (!d.objectStoreNames.contains("meta")) {
          d.createObjectStore("meta", { keyPath: "chiave" });
        }
      },
    });
  }
  return db;
}

/**
 * Lo specchio esiste solo nel browser e solo se IndexedDB c'e. In SSR, o
 * dentro una finestra privata che lo nega, si risponde "non disponibile" e
 * tutto continua a funzionare come prima: e un lusso, non una condizione.
 */
export function disponibile(): boolean {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

async function meta<T extends string | number | boolean>(chiave: string): Promise<T | null> {
  const d = await apri();
  const r = await d.get("meta", chiave);
  return r ? (r.valore as T) : null;
}

async function scriviMeta(chiave: string, valore: string | number | boolean): Promise<void> {
  const d = await apri();
  await d.put("meta", { chiave, valore });
}

/**
 * Vero solo dopo una sincronizzazione completa. Non chiede chi sei di
 * proposito: sapere l'utente vuol dire chiedere la sessione, e questa
 * domanda sta davanti a OGNI lettura — una domanda che costa rete davanti a
 * una lettura fatta per non usare la rete sarebbe un cerchio ridicolo. Che
 * lo specchio sia della persona giusta lo garantiscono i due estremi: il
 * logout lo svuota (`svuotaSpecchio`) e la sincronizzazione lo svuota se
 * trova un altro id (`assicuraUtente`). Fra i due, non c'e modo che una
 * giornata di un altro account finisca qui dentro.
 */
export async function pronto(): Promise<boolean> {
  if (!disponibile()) return false;
  try {
    return (await meta<boolean>("pronto")) === true;
  } catch {
    return false;
  }
}

/**
 * Quante righe in chiaro (le giornate mai passate dalla cassaforte, R12) ha
 * il server. Zero e il caso normale: saperlo permette di NON fare la query
 * di ripiego a ogni lettura, che e mezza latenza buttata.
 */
export async function righeInChiaro(): Promise<number> {
  if (!disponibile()) return 0;
  try {
    return (await meta<number>("inChiaro")) ?? 0;
  } catch {
    return 0;
  }
}

export async function svuotaSpecchio(): Promise<void> {
  if (!disponibile()) return;
  try {
    const d = await apri();
    const tx = d.transaction(["cassettine", "meta"], "readwrite");
    await Promise.all([tx.objectStore("cassettine").clear(), tx.objectStore("meta").clear()]);
    await tx.done;
  } catch {
    // Uno specchio che non si svuota non deve bloccare un logout.
  }
}

/** Se davanti allo specchio si presenta un altro account, lo specchio si svuota. */
export async function assicuraUtente(userId: string): Promise<void> {
  const chi = await meta<string>("utente");
  if (chi === userId) return;
  await svuotaSpecchio();
  await scriviMeta("utente", userId);
}

export async function una(giorno: string): Promise<RigaSpecchio | null> {
  const d = await apri();
  return (await d.get("cassettine", giorno)) ?? null;
}

export async function tra(da: string, a: string): Promise<RigaSpecchio[]> {
  const d = await apri();
  const righe = await d.getAll("cassettine", IDBKeyRange.bound(da, a));
  return righe.sort((x, y) => (x.giorno < y.giorno ? 1 : -1));
}

export async function metti(righe: RigaSpecchio[]): Promise<void> {
  if (righe.length === 0) return;
  const d = await apri();
  const tx = d.transaction("cassettine", "readwrite");
  for (const r of righe) void tx.store.put(r);
  await tx.done;
}

export async function togli(giorni: string[]): Promise<void> {
  if (giorni.length === 0) return;
  const d = await apri();
  const tx = d.transaction("cassettine", "readwrite");
  for (const g of giorni) void tx.store.delete(g);
  await tx.done;
}

/** L'elenco locale: giorno -> versione. E la meta del confronto. */
export async function elencoLocale(): Promise<Map<string, number>> {
  const d = await apri();
  const righe = await d.getAll("cassettine");
  return new Map(righe.map((r) => [r.giorno, r.v]));
}

export async function segnaPronto(inChiaro: number): Promise<void> {
  await scriviMeta("inChiaro", inChiaro);
  await scriviMeta("pronto", true);
}
