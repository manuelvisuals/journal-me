"use client";

/**
 * La memoria del messaggio di benvenuto all'avvio.
 *
 * Tre pezzi di stato, tre posti diversi, ognuno per un motivo:
 *
 * 1. "gia mostrato in QUESTA apertura" -> una variabile di MODULO. Vive
 *    quanto il documento e muore col processo. Non sessionStorage: iOS lo
 *    ripristina al rilancio e un avvio genuinamente freddo verrebbe scambiato
 *    per una navigazione. Non uno stato React e non un useRef: quelli
 *    muoiono col montaggio, e qui il componente si monta e smonta piu volte.
 * 2. il CONTATORE delle aperture -> localStorage. Non il database: "si
 *    azzera se reinstalli l'app" e una proprieta del DISPOSITIVO, non
 *    dell'account, e l'account del revisore Apple e condiviso (un contatore
 *    sul server gli farebbe trovare la casella gia alla prima apertura).
 * 3. il SILENZIO ("non mostrare piu") -> localStorage, e dentro ci stanno
 *    l'identita della sessione E la versione del messaggio: cosi un login
 *    nuovo lo invalida da se, e lo invalida anche un messaggio riscritto,
 *    senza bisogno di ricordarsi di cancellarlo.
 *
 *    La versione arriva dal pannello admin (tasto "mostralo di nuovo",
 *    migration 018). Senza, il giorno che Manuel riscrive la lettera non la
 *    leggerebbe proprio chi apre l'app tutte le sere — e in modalita locale
 *    quel silenzio non scadrebbe mai, perche li non esiste nessun logout.
 *
 * L'identita e il `session_id` dentro il JWT di Supabase: nasce col login,
 * SOPRAVVIVE ai rinnovi del token, muore col logout. E' esattamente la
 * durata che serve. Il refresh_token no: ruota a ogni rinnovo, e un
 * silenzio legato a lui si slegherebbe da solo dopo un'ora.
 */

import type { ResolvedMode } from "@/lib/data/store";

/** Da quale apertura in poi compare la casella "non mostrare piu".
 *  E' una decisione di prodotto: sta qui, con un nome, perche cambiera. */
export const APRI_CASELLA_DALLA = 3;

const K_CONTEGGIO = "jm.saluto.conteggio";
const K_SILENZIO = "jm.saluto.silenzio";
const K_DISPOSITIVO = "jm.saluto.dispositivo";

/* ---------- 1. una volta per apertura ---------- */

let mostratoInQuestaApertura = false;

export function giaMostratoInQuestaApertura(): boolean {
  return mostratoInQuestaApertura;
}

export function segnaMostrato(): void {
  mostratoInQuestaApertura = true;
}

/**
 * Azzera "gia mostrato". Va chiamata quando si scopre che NON c'e nessun
 * utente, non solo sull'evento di logout: e il punto dove si incontrano
 * tutte le uscite, compresa la sessione che il server rifiuta senza
 * emettere alcun evento. E' idempotente.
 *
 * Serve perche in questa app il logout NON ricarica il documento: fa
 * router.push("/login"), cioe una navigazione client. Il modulo JS resta
 * caricato, e senza questa riga chi esce e rientra nella stessa apertura
 * dell'app non rivedrebbe il messaggio.
 */
export function azzeraApertura(): void {
  mostratoInQuestaApertura = false;
}

/* ---------- lettura veloce, senza rete ---------- */

function leggi(k: string): string | null {
  try {
    return window.localStorage.getItem(k);
  } catch {
    return null;
  }
}

function scrivi(k: string, v: string): void {
  try {
    window.localStorage.setItem(k, v);
  } catch {
    // Un dispositivo che non concede localStorage rivedra il messaggio a
    // ogni apertura: fastidioso, non rotto.
  }
}

function cancella(k: string): void {
  try {
    window.localStorage.removeItem(k);
  } catch {}
}

/** C'e un silenzio scritto su questo dispositivo? Non dice ancora se e
 *  valido: quello lo sa solo la strada lenta, che conosce l'identita. */
export function silenzioScritto(): boolean {
  return leggi(K_SILENZIO) !== null;
}

/* ---------- 2. l'identita della sessione ---------- */

function payloadJwt(token: string): Record<string, unknown> | null {
  try {
    const corpo = token.split(".")[1];
    if (!corpo) return null;
    const json = atob(corpo.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** L'id di dispositivo della modalita locale: li di account non ce n'e
 *  nessuno, quindi l'identita e il dispositivo. Nasce alla prima apertura
 *  e muore con i dati del sito (cioe con la reinstallazione). */
function identitaDispositivo(): string {
  const gia = leggi(K_DISPOSITIVO);
  if (gia) return gia;
  const nuova = `dev:${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  scrivi(K_DISPOSITIVO, nuova);
  return nuova;
}

/**
 * Chi e, adesso. `null` vuol dire "nessuno": il messaggio non si mostra e
 * niente viene contato.
 */
export async function identita(mode: ResolvedMode): Promise<string | null> {
  if (mode === "local") return identitaDispositivo();
  if (mode !== "cloud") return null;
  // In locale il client Supabase non si costruisce nemmeno: import
  // dinamico, come fa AuthGate.
  const { createClient } = await import("@/lib/supabase/client");
  const { data } = await createClient().auth.getSession();
  const sessione = data.session;
  if (!sessione) return null;
  const p = payloadJwt(sessione.access_token);
  const sid = typeof p?.session_id === "string" ? p.session_id : null;
  // Ultima spiaggia: l'utente. Peggio del session_id (non distingue due
  // login diversi dello stesso account) ma meglio del refresh_token, che
  // ruota a ogni rinnovo e slegherebbe il silenzio da solo.
  return sid ? `sid:${sid}` : `usr:${sessione.user.id}`;
}

/* ---------- 3. contatore e silenzio ---------- */

type Conteggio = { sid: string; n: number };

function leggiConteggio(): Conteggio | null {
  const grezzo = leggi(K_CONTEGGIO);
  if (!grezzo) return null;
  try {
    const v = JSON.parse(grezzo) as Partial<Conteggio>;
    if (typeof v.sid === "string" && typeof v.n === "number") {
      return { sid: v.sid, n: v.n };
    }
  } catch {}
  return null;
}

/**
 * Registra questa apertura e dice se va mostrata la casella.
 * Un conteggio che appartiene a un'identita diversa non conta: riparte.
 */
export function contaApertura(id: string): { n: number; casella: boolean } {
  const vecchio = leggiConteggio();
  const n = vecchio && vecchio.sid === id ? vecchio.n + 1 : 1;
  scrivi(K_CONTEGGIO, JSON.stringify({ sid: id, n } satisfies Conteggio));
  return { n, casella: n >= APRI_CASELLA_DALLA };
}

/** Il silenzio e di UNA identita e di UNA versione del messaggio. */
function marchio(id: string, versione: number): string {
  return `${id}#v${versione}`;
}

/**
 * Il silenzio vale solo per l'identita che l'ha chiesto e per la versione
 * del messaggio che quell'identita aveva letto. Se ne trova uno di un login
 * ormai morto, o di un messaggio poi riscritto, lo butta: e la riga che fa
 * ripartire il saluto dopo un logout e dopo un "mostralo di nuovo".
 */
export function silenzioVale(id: string, versione: number): boolean {
  const scritto = leggi(K_SILENZIO);
  if (scritto === null) return false;
  if (scritto === marchio(id, versione)) return true;
  cancella(K_SILENZIO);
  return false;
}

export function chiediSilenzio(id: string, versione: number): void {
  scrivi(K_SILENZIO, marchio(id, versione));
}
