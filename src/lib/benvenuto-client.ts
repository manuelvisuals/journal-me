"use client";

/**
 * Il messaggio di benvenuto letto dal client.
 *
 * DUE REGOLE CHE NON SI POSSONO ROMPERE, le stesse delle aree.
 *
 * 1. In modalita' locale non si tocca la rete: e' la promessa piu'
 *    importante dell'app (SPEC-v2 par. 1) e ha un banco che la controlla.
 *    Chi tiene il diario sul telefono vede il testo cotto nel pacchetto.
 * 2. Il primo render non aspetta nessuno. Si parte dalla copia in cache
 *    dell'ultima volta (o dal testo di fabbrica) e, se dal database arriva
 *    qualcosa di diverso, si aggiorna. Il saluto si dipinge nello STESSO
 *    fotogramma della schermata: un riquadro che compare vuoto e poi si
 *    riempie sarebbe peggio di non averlo.
 *
 * Per questo la cache si legge in modo sincrono al primo accesso, e non
 * dentro un effetto: quando il saluto chiede il testo, il testo c'e' gia'.
 */

import { useSyncExternalStore } from "react";
import {
  BENVENUTO_DI_FABBRICA,
  benvenutoDaRiga,
  urlBenvenuto,
  type Benvenuto,
} from "@/lib/benvenuto";
import { useStorageMode } from "@/lib/data/store";

const CHIAVE_CACHE = "jm.benvenuto";

let corrente: Benvenuto = BENVENUTO_DI_FABBRICA;
let letto = false;
let caricato = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

/** La copia dell'ultima volta. Si legge una volta sola, e subito. */
function dallaCache(): void {
  if (letto) return;
  letto = true;
  try {
    const grezzo = window.localStorage.getItem(CHIAVE_CACHE);
    if (!grezzo) return;
    corrente = benvenutoDaRiga(JSON.parse(grezzo) as Record<string, unknown>);
  } catch {
    // cache illeggibile: resta il testo di fabbrica
  }
}

function inCache(riga: unknown): void {
  try {
    window.localStorage.setItem(CHIAVE_CACHE, JSON.stringify(riga));
  } catch {
    // niente cache: si rileggera' la prossima volta
  }
}

function carica(): void {
  if (caricato) return;
  caricato = true;

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !key) return;

  void fetch(urlBenvenuto(base), {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((righe: Record<string, unknown>[] | null) => {
      const riga = Array.isArray(righe) ? righe[0] : null;
      if (!riga) return;
      corrente = benvenutoDaRiga(riga);
      inCache(riga);
      emit();
    })
    .catch(() => {
      // il database non risponde: resta il testo di fabbrica
    });
}

/**
 * Il testo, subito. In cloud parte anche una lettura in sottofondo: se il
 * pannello ha cambiato qualcosa, il riquadro si aggiorna mentre e' aperto.
 */
export function useBenvenuto(): Benvenuto {
  const mode = useStorageMode();
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      if (mode === "cloud") carica();
      return () => {
        listeners.delete(l);
      };
    },
    () => {
      dallaCache();
      return corrente;
    },
    () => BENVENUTO_DI_FABBRICA,
  );
}

/**
 * L'indirizzo a cui scrivere, per chi non e' il saluto: lo chiede la
 * linguetta Feedback, che resta muta finche' e' vuoto.
 *
 * Non fa partire nessuna lettura: se il saluto non e' ancora passato di
 * qui, la linguetta usa la cache dell'ultima volta. Una linguetta che
 * accende una richiesta di rete tutta sua romperebbe la regola 1 il giorno
 * che qualcuno la monta su una pagina pubblica.
 */
export function contattoUrlNoto(): string {
  dallaCache();
  return corrente.contattoUrl.trim();
}
