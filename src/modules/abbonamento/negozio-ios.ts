"use client";

/**
 * Il negozio di Apple visto da JavaScript (In-App Purchase, StoreKit 2).
 * Deciso da Manuel il 4 settembre 2026; mockup abbonamento-iphone.html v3.
 *
 * Il lato nativo e ios/App/App/Abbonamento.swift. Qui: leggere i prodotti
 * (prezzo e prova come li dice Apple), comprare, ripristinare, aprire la
 * pagina Abbonamenti di Apple, e ascoltare le transazioni che arrivano da
 * sole (rinnovi, acquisti finiti fuori dall'app).
 *
 * LA REGOLA: il telefono non accende mai premium. Ogni transazione va a
 * /api/apple/verifica; e il server, dopo aver chiesto ad Apple, a scrivere
 * il piano. Solo DOPO la risposta del server la transazione si segna finita
 * (finisci): se l'app muore prima, Apple la ripropone al prossimo avvio.
 *
 * Sul web il negozio non esiste: il muro rimanda all'App Store. Per i
 * banchi c'e `window.__jmNegozioFinto`, un negozio finto con la stessa
 * forma del plugin (come `__jmVetroFinto` per il dock).
 */
import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import { apiFetch } from "@/lib/api";
import { isNative } from "@/lib/native/platform";
import { forcePlanRefresh, setPlanNow } from "@/lib/plan";
import { aggiornaStatoOspite, setPremiumDispositivo } from "@/lib/ospite/stato";
import { PRODOTTI_IOS, type ProdottoIos } from "@/lib/pricing";

export type ProdottoNegozio = {
  id: string;
  /** Quale dei nostri e (mensile, annuale). */
  chiave: ProdottoIos;
  /** Gia formattato da Apple nella lingua e valuta della persona: "4,99 EUR". */
  prezzo: string;
  valuta?: string;
  nome?: string;
  /** "mese" | "anno" | "settimana" | "giorno" */
  periodo: string;
  /** I giorni della prova gratis, se il prodotto ne ha una. */
  provaGiorni?: number;
  /** false se questo Apple ID la prova l'ha gia usata. */
  provaDisponibile?: boolean;
};

type Transazione = {
  jws: string;
  transactionId: string;
  originalTransactionId: string;
  productId: string;
};

type EsitoCompra =
  | ({ esito: "ok" } & Transazione)
  | { esito: "annullato" }
  | { esito: "in_attesa" };

type PluginAbbonamento = {
  prodotti(o: { ids: string[] }): Promise<{ prodotti: Omit<ProdottoNegozio, "chiave">[] }>;
  compra(o: { id: string }): Promise<EsitoCompra>;
  ripristina(): Promise<{ transazioni: Transazione[] }>;
  gestisci(): Promise<void>;
  finisci(o: { transactionId: string }): Promise<void>;
  addListener(
    evento: "transazione",
    f: (t: Transazione) => void,
  ): Promise<PluginListenerHandle> | PluginListenerHandle;
};

declare global {
  interface Window {
    __jmNegozioFinto?: PluginAbbonamento;
  }
}

let plugin: PluginAbbonamento | null = null;

function negozio(): PluginAbbonamento | null {
  if (typeof window !== "undefined" && window.__jmNegozioFinto) return window.__jmNegozioFinto;
  if (!isNative()) return null;
  if (!plugin) plugin = registerPlugin<PluginAbbonamento>("Abbonamento");
  return plugin;
}

/** C'e un negozio (il guscio iOS, o il finto dei banchi)? Sul web: no. */
export function negozioDisponibile(): boolean {
  return negozio() !== null;
}

function chiaveDi(id: string): ProdottoIos | null {
  for (const k of Object.keys(PRODOTTI_IOS) as ProdottoIos[]) {
    if (PRODOTTI_IOS[k] === id) return k;
  }
  return null;
}

/**
 * LA CACHE DEI PRODOTTI. Product.products di StoreKit puo impiegare secondi
 * (in sandbox, senza account attivo, anche decine): se il muro lo chiede
 * quando si apre, la scheda resta "-,- EUR" per tutto quel tempo (Manuel, 6
 * settembre 2026: "esigo che sia istantanea"). Si chiedono TUTTI i nostri
 * prodotti una volta, all'avvio del guscio (precaricaProdotti), e il muro
 * legge da qui. Il negozio e Apple, non il nostro server: la promessa "aprire
 * l'app non chiama nessuna route" resta intera.
 */
let prodottiInCache: Omit<ProdottoNegozio, "chiave">[] | null = null;
let caricamentoProdotti: Promise<Omit<ProdottoNegozio, "chiave">[]> | null = null;

function tuttiGliId(): string[] {
  return Object.values(PRODOTTI_IOS) as string[];
}

async function caricaProdotti(): Promise<Omit<ProdottoNegozio, "chiave">[]> {
  const n = negozio();
  if (!n) return [];
  if (caricamentoProdotti) return caricamentoProdotti;
  caricamentoProdotti = (async () => {
    try {
      const { prodotti } = await n.prodotti({ ids: tuttiGliId() });
      prodottiInCache = prodotti;
      return prodotti;
    } catch {
      return prodottiInCache ?? [];
    } finally {
      caricamentoProdotti = null;
    }
  })();
  return caricamentoProdotti;
}

/** All'avvio del guscio: scalda la cache, senza aspettare nessuno. */
export function precaricaProdotti(): void {
  if (!negozio() || prodottiInCache || caricamentoProdotti) return;
  void caricaProdotti();
}

/** La vetrina puo essere cambiata (entrati nell'App Store dal foglio): si rilegge. */
export function dimenticaProdotti(): void {
  prodottiInCache = null;
}

/** I prodotti gia in tasca, subito e senza promesse; null se non ancora arrivati. */
export function prodottiInTasca(annualeAttivo: boolean): ProdottoNegozio[] | null {
  if (!prodottiInCache) return null;
  return filtra(prodottiInCache, annualeAttivo);
}

function filtra(lista: Omit<ProdottoNegozio, "chiave">[], annualeAttivo: boolean): ProdottoNegozio[] {
  const ids: string[] = [PRODOTTI_IOS.mensile, ...(annualeAttivo ? [PRODOTTI_IOS.annuale] : [])];
  const out: ProdottoNegozio[] = [];
  for (const p of lista) {
    const chiave = chiaveDi(p.id);
    if (!chiave) continue;
    if (chiave === "annuale" && !annualeAttivo) continue;
    out.push({ ...p, chiave });
  }
  out.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  return out;
}

/**
 * I prodotti da mostrare, nell'ordine delle schede: mensile e, SOLO se
 * l'interruttore del pannello lo dice, annuale. Un prodotto che Apple non
 * conosce (per esempio l'annuale non ancora creato su App Store Connect)
 * non compare, senza errori. Dalla cache se c'e, altrimenti da Apple.
 */
export async function prodottiPremium(annualeAttivo: boolean): Promise<ProdottoNegozio[]> {
  if (!negozio()) return [];
  const lista = prodottiInCache ?? (await caricaProdotti());
  return filtra(lista, annualeAttivo);
}

export type EsitoAcquisto =
  | { esito: "premium"; expiresAt: string | null }
  | { esito: "annullato" }
  | { esito: "in_attesa" }
  | { esito: "errore"; messaggio: string };

/**
 * Manda una transazione al server e, se il server ha scritto premium,
 * aggiorna il piano in tasca e segna la transazione finita.
 */
async function consegnaAlServer(t: Transazione): Promise<EsitoAcquisto> {
  const n = negozio();
  let resp: Response;
  try {
    resp = await apiFetch("/api/apple/verifica", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jws: t.jws, transactionId: t.transactionId }),
    });
  } catch {
    return { esito: "errore", messaggio: "Il server non risponde: riprova fra poco. L'acquisto e al sicuro presso Apple." };
  }
  // Una risposta DEFINITIVA del server (l'ha guardata con Apple: vale,
  // non vale piu, e di un altro, Apple non la trova) chiude la transazione
  // presso Apple, qualunque sia il verdetto. Se resta aperta, StoreKit la
  // ripropone a ogni avvio e, peggio, al prossimo acquisto dello stesso
  // prodotto Apple RESTITUISCE QUELLA invece di venderne una nuova (5
  // settembre 2026: la ricevuta scaduta del giorno prima tornava a ogni
  // "Compra", e il server diceva giustamente "non attivo"). Restano aperte
  // solo le transazioni che il server non ha potuto giudicare (5xx, rete).
  const definitiva = resp.ok || resp.status === 404 || resp.status === 409;
  if (definitiva) {
    try {
      await n?.finisci({ transactionId: t.transactionId });
    } catch {
      // la finiremo al prossimo avvio: Apple la ripropone
    }
  }
  if (resp.status === 401) {
    return { esito: "errore", messaggio: "Il server non ha riconosciuto questo telefono: riapri l'app e tocca Ripristina acquisti." };
  }
  if (resp.status === 409) {
    return { esito: "errore", messaggio: "Questo abbonamento e legato a un altro account: entra con quello." };
  }
  if (!resp.ok) {
    let m = `Il server ha risposto ${resp.status}.`;
    try {
      const j = (await resp.json()) as { error?: string; messaggio?: string };
      if (j.messaggio) m = j.messaggio;
      else if (j.error) m = j.error;
    } catch {
      // niente corpo
    }
    return { esito: "errore", messaggio: m };
  }
  const dati = (await resp.json()) as { plan?: string; expiresAt?: string | null; dove?: string };
  if (dati.plan === "premium") {
    if (dati.dove === "dispositivo") {
      // Comprato senza email (mockup premium-senza-password, B1): il
      // premium vive sul braccialetto del telefono. Si ricorda la scadenza
      // e si rilegge lo stato, che ora dice premiumFino.
      setPremiumDispositivo(dati.expiresAt ?? null);
      void aggiornaStatoOspite();
    } else {
      setPlanNow("premium");
      void forcePlanRefresh();
    }
    return { esito: "premium", expiresAt: dati.expiresAt ?? null };
  }
  return { esito: "errore", messaggio: "Questo abbonamento e scaduto: puoi riattivarlo da qui." };
}

/** Compra (apre il foglio di Apple) e consegna al server. */
export async function compraPremium(productId: string): Promise<EsitoAcquisto> {
  const n = negozio();
  if (!n) return { esito: "errore", messaggio: "Il negozio non e disponibile qui." };
  let r: EsitoCompra;
  try {
    r = await n.compra({ id: productId });
  } catch (e) {
    return { esito: "errore", messaggio: String((e as Error).message ?? e) };
  }
  if (r.esito === "annullato") return { esito: "annullato" };
  if (r.esito === "in_attesa") return { esito: "in_attesa" };
  return consegnaAlServer(r);
}

/**
 * Ripristina: chiede ad Apple le transazioni valide per questo Apple ID e
 * le consegna al server. Torna "premium" se almeno una vale.
 */
export async function ripristinaAcquisti(): Promise<EsitoAcquisto> {
  const n = negozio();
  if (!n) return { esito: "errore", messaggio: "Il negozio non e disponibile qui." };
  let lista: Transazione[];
  try {
    lista = (await n.ripristina()).transazioni ?? [];
  } catch (e) {
    return { esito: "errore", messaggio: String((e as Error).message ?? e) };
  }
  if (lista.length === 0) {
    return { esito: "errore", messaggio: "Nessun acquisto da ripristinare con questo Apple ID." };
  }
  let ultimo: EsitoAcquisto = { esito: "errore", messaggio: "Nessun abbonamento attivo." };
  for (const t of lista) {
    ultimo = await consegnaAlServer(t);
    if (ultimo.esito === "premium") return ultimo;
  }
  return ultimo;
}

/** Apre la pagina Abbonamenti di Apple (cambiare piano, disdire). */
export async function gestisciAbbonamento(): Promise<boolean> {
  const n = negozio();
  if (!n) return false;
  try {
    await n.gestisci();
    return true;
  } catch {
    return false;
  }
}

let ascoltoAvviato = false;

/**
 * Le transazioni che arrivano da sole (rinnovo, acquisto approvato dopo,
 * ripristino da un altro dispositivo): si consegnano al server. Da
 * chiamare una volta, dal guscio (PremiumWall e montato una volta sola).
 */
export function ascoltaTransazioni(): void {
  if (ascoltoAvviato) return;
  const n = negozio();
  if (!n) return;
  ascoltoAvviato = true;
  precaricaProdotti();
  void n.addListener("transazione", (t) => {
    void consegnaAlServer(t);
  });
}
