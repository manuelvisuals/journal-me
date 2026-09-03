"use client";

/**
 * La cassaforte (SPEC ospite-e-cassaforte, R6 R7 R8, §6-bis): lo stato su
 * questo dispositivo, le chiavi in memoria, la prova sul server.
 *
 * Tre stati possibili per un utente cloud:
 *
 *  - "assente": sul server non c'e nessuna cassaforte per questo utente. Va
 *    CREATA (semeNuovo -> parole -> prova sul server -> seme nel portachiavi)
 *    e la persona vede le otto parole una volta sola;
 *  - "chiusa": sul server la cassaforte c'e, ma questo dispositivo non ha il
 *    seme (browser nuovo, iCloud spento). Servono le parole;
 *  - "aperta": il seme c'e, le chiavi sono in memoria, la prova sul server
 *    si apre. Si legge e si scrive.
 *
 * Chi legge e scrive i dati (src/lib/data/store/cloud.ts) chiede `chiavi()`
 * e basta: non sa da dove vengono. Se la cassaforte non e aperta riceve
 * CassaforteChiusa, e il cancello (modulo accesso) porta la persona alla
 * schermata giusta.
 *
 * La modalita locale non passa di qui: le giornate non lasciano il
 * dispositivo, e non c'e niente da chiudere a chiave verso un server.
 */
import { conTetto } from "@/lib/tetto";
import { leggiSeme, scriviSeme, cancellaSeme } from "./chiave";
import { paroleDaSeme, semeDaParole, semeNuovo, type EsitoParole } from "./parole";
import {
  apri,
  bustaDaTesto,
  chiaviDaSeme,
  chiudi,
  testoDaBusta,
  FRASE_DI_PROVA,
  type Chiavi,
} from "./serratura";

export type StatoCassaforte = "risolvendo" | "assente" | "chiusa" | "aperta" | "locale";

export class CassaforteChiusa extends Error {
  constructor() {
    super("La cassaforte non e aperta su questo dispositivo");
    this.name = "CassaforteChiusa";
  }
}

type Interno = {
  stato: StatoCassaforte;
  userId: string | null;
  chiavi: Chiavi | null;
  seme: Uint8Array | null;
  /**
   * Il cancello da mostrare ("assente" -> le parole nuove, "chiusa" -> le
   * parole da scrivere). Resta acceso anche quando la cassaforte si apre:
   * lo spegne SOLO la persona, col tasto in fondo alla schermata (le parole
   * vanno viste e salvate prima di entrare).
   */
  cancello: "assente" | "chiusa" | null;
};

const interno: Interno = { stato: "risolvendo", userId: null, chiavi: null, seme: null, cancello: null };
const ascoltatori = new Set<() => void>();
function avvisa() {
  for (const a of ascoltatori) a();
}
function imposta(p: Partial<Interno>) {
  Object.assign(interno, p);
  if (p.stato === "assente" || p.stato === "chiusa") interno.cancello = p.stato;
  if (p.stato === "locale") interno.cancello = null;
  avvisa();
}

/** Quale cancello mostrare, o null. Lo spegne `passaCancello()`. */
export function cancelloDaMostrare(): "assente" | "chiusa" | null {
  return interno.cancello;
}

export function passaCancello(): void {
  interno.cancello = null;
  avvisa();
}

export function statoCassaforte(): StatoCassaforte {
  return interno.stato;
}

export function ascoltaCassaforte(cb: () => void): () => void {
  ascoltatori.add(cb);
  return () => ascoltatori.delete(cb);
}

/** Le chiavi del diario, o CassaforteChiusa. */
export function chiavi(): Chiavi {
  if (interno.stato !== "aperta" || !interno.chiavi) throw new CassaforteChiusa();
  return interno.chiavi;
}

export function cassaforteAperta(): boolean {
  return interno.stato === "aperta";
}

async function supabase() {
  const { createClient } = await import("@/lib/supabase/client");
  return createClient();
}

/** La riga `cassaforte_utente` sul server, o null. */
async function leggiProva(userId: string): Promise<string | null> {
  const sb = await supabase();
  const { data, error } = await sb
    .from("cassaforte_utente")
    .select("prova")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as { prova?: string } | null)?.prova ?? null;
}

async function provaSiApre(ch: Chiavi, prova: string): Promise<boolean> {
  const b = bustaDaTesto(prova);
  if (!b) return false;
  try {
    const frase = await apri<string>(ch.aes, b);
    return frase === FRASE_DI_PROVA;
  } catch {
    return false;
  }
}

/**
 * Risolve lo stato per l'utente loggato. Da chiamare dal cancello, dopo che
 * la sessione cloud e nota. Idempotente: richiamarla con lo stesso utente a
 * cassaforte aperta non ricalcola niente.
 */
export async function risolviCassaforte(userId: string): Promise<StatoCassaforte> {
  if (interno.userId === userId && interno.stato === "aperta") return "aperta";
  imposta({ stato: "risolvendo", userId, chiavi: null, seme: null });
  const [seme, prova] = await Promise.all([
    leggiSeme(userId).catch(() => null),
    conTetto(leggiProva(userId), 20_000, "prova della cassaforte"),
  ]);
  if (!prova) {
    // Nessuna cassaforte sul server: si crea. Un seme rimasto sul dispositivo
    // da un account cancellato non conta: la cassaforte nuova avra il suo.
    imposta({ stato: "assente" });
    return "assente";
  }
  if (!seme) {
    imposta({ stato: "chiusa" });
    return "chiusa";
  }
  const ch = await chiaviDaSeme(seme, userId);
  if (!(await provaSiApre(ch, prova))) {
    // Il seme sul dispositivo non e quello di QUESTA cassaforte (account
    // ricominciato da zero altrove): come non averlo.
    imposta({ stato: "chiusa" });
    return "chiusa";
  }
  imposta({ stato: "aperta", chiavi: ch, seme });
  return "aperta";
}

/** In modalita locale non c'e cassaforte: lo stato lo dice, cosi nessuno aspetta. */
export function segnaModalitaLocale(): void {
  imposta({ stato: "locale", userId: null, chiavi: null, seme: null });
}

/**
 * Crea la cassaforte per l'utente: seme nuovo, prova sul server, seme nel
 * portachiavi. Restituisce le otto parole, da mostrare UNA volta.
 */
let creazioneInCorso: { userId: string; promessa: Promise<string[]> } | null = null;

export function creaCassaforte(userId: string): Promise<string[]> {
  // Una sola creazione per volta: in sviluppo React monta gli effetti due
  // volte, e due semi diversi per la stessa cassaforte sarebbero un disastro
  // (il secondo insert fallirebbe e la persona vedrebbe un errore al posto
  // delle parole).
  if (creazioneInCorso && creazioneInCorso.userId === userId) return creazioneInCorso.promessa;
  const promessa = creaCassaforteDavvero(userId).finally(() => {
    if (creazioneInCorso?.promessa === promessa) creazioneInCorso = null;
  });
  creazioneInCorso = { userId, promessa };
  return promessa;
}

async function creaCassaforteDavvero(userId: string): Promise<string[]> {
  if (interno.stato === "aperta" && interno.userId === userId && interno.seme) {
    return paroleDaSeme(interno.seme);
  }
  const seme = semeNuovo();
  const ch = await chiaviDaSeme(seme, userId);
  const prova = testoDaBusta(await chiudi(ch.aes, FRASE_DI_PROVA));
  const sb = await supabase();
  const { error } = await sb.from("cassaforte_utente").insert({ user_id: userId, prova });
  if (error) throw new Error(error.message);
  await scriviSeme(userId, seme);
  imposta({ stato: "aperta", userId, chiavi: ch, seme });
  return paroleDaSeme(seme);
}

export type EsitoSblocco =
  | { ok: true }
  | { ok: false; motivo: EsitoParole & { ok: false } }
  | { ok: false; motivo: { motivo: "non-apre" } };

/**
 * Apre la cassaforte su un dispositivo nuovo con le otto parole. Se le
 * parole sono valide ma non aprono la prova (parole di un altro diario),
 * risponde "non-apre" senza scrivere niente sul dispositivo.
 */
export async function sbloccaConParole(userId: string, parole: string | string[]): Promise<EsitoSblocco> {
  const esito = await semeDaParole(parole);
  if (!esito.ok) return { ok: false, motivo: esito };
  const prova = await conTetto(leggiProva(userId), 20_000, "prova della cassaforte");
  if (!prova) return { ok: false, motivo: { motivo: "non-apre" } };
  const ch = await chiaviDaSeme(esito.seme, userId);
  if (!(await provaSiApre(ch, prova))) return { ok: false, motivo: { motivo: "non-apre" } };
  await scriviSeme(userId, esito.seme);
  imposta({ stato: "aperta", userId, chiavi: ch, seme: esito.seme });
  return { ok: true };
}

/** Le otto parole di questa cassaforte (per Impostazioni, dietro Face ID). */
export async function paroleCorrenti(): Promise<string[] | null> {
  if (!interno.seme) return null;
  return paroleDaSeme(interno.seme);
}

/**
 * Ricomincia da zero: cancella la cassaforte sul server e le cassettine che
 * la abitano (RLS: solo le proprie), poi ne crea una nuova. Le giornate
 * chiuse con la chiave vecchia sono perse: chi chiama lo ha gia detto alla
 * persona, due volte.
 */
export async function ricominciaDaZero(userId: string): Promise<string[]> {
  const sb = await supabase();
  const c = await sb.from("cassettine").delete().eq("user_id", userId);
  if (c.error) throw new Error(c.error.message);
  const p = await sb.from("cassaforte_utente").delete().eq("user_id", userId);
  if (p.error) throw new Error(p.error.message);
  await cancellaSeme(userId).catch(() => undefined);
  imposta({ stato: "assente", userId, chiavi: null, seme: null });
  return creaCassaforte(userId);
}

/** Al logout: via le chiavi dalla memoria (il seme resta nel portachiavi). */
export function chiudiCassaforteInMemoria(): void {
  imposta({ stato: "risolvendo", userId: null, chiavi: null, seme: null });
}
