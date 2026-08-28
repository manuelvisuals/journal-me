"use client";

/**
 * La foto profilo: una verita sola, letta una volta, vista in tre posti.
 *
 * Il pallino la mostra nell'intestazione del telefono e nella rail del
 * computer (entrambi sono `AccountMenu`, scheletro), e la riga "Foto profilo"
 * la mostra dentro le Impostazioni. Se ognuno se la leggesse per conto suo,
 * dopo un cambio si vedrebbero tre stati diversi nella stessa schermata
 * finche non si ricarica: per questo la foto vive in UNO store e chi la
 * mostra si limita a leggerlo.
 *
 * Sta nel modulo impostazioni — che e chi la sa cambiare — ed esce dalla
 * PORTA (`@/modules/impostazioni`). Lo scheletro importa `useFotoProfilo`
 * da li, come gia fa con il muro premium di abbonamento.
 *
 * `undefined` = non ancora letta (il pallino mostra l'iniziale e non
 * lampeggia); `null` = letta, e non c'e (l'iniziale e definitiva).
 */

import { useEffect, useSyncExternalStore } from "react";
import { apiFetch } from "@/lib/api";
import { resolveStorageMode } from "@/lib/data/store";

type Foto = string | null | undefined;

let foto: Foto = undefined;
let lettura: Promise<void> | null = null;
const ascoltatori = new Set<() => void>();

function emetti(): void {
  for (const a of ascoltatori) a();
}

function iscrivi(a: () => void): () => void {
  ascoltatori.add(a);
  return () => ascoltatori.delete(a);
}

/**
 * Legge la foto dal profilo. Una volta sola: la promessa resta in mano allo
 * store, cosi tre componenti montati insieme fanno UNA richiesta, non tre.
 */
function leggi(): Promise<void> {
  if (lettura) return lettura;
  lettura = (async () => {
    try {
      // In locale non c'e nessun account, quindi nessuna foto: e una
      // risposta, non un errore.
      if ((await resolveStorageMode()) === "local") {
        foto = null;
        return;
      }
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        foto = null;
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("avatar_data")
        .eq("user_id", user.id)
        .maybeSingle();
      foto = (data?.avatar_data as string | null | undefined) ?? null;
    } catch {
      // Colonna non ancora applicata (migration 016 da incollare), rete
      // assente, sessione scaduta: in tutti e tre i casi la risposta giusta
      // e "nessuna foto", non una schermata rotta.
      foto = null;
    } finally {
      emetti();
    }
  })();
  return lettura;
}

/** La foto attuale. Chi la usa non deve sapere da dove arriva. */
export function useFotoProfilo(): Foto {
  const v = useSyncExternalStore(
    iscrivi,
    () => foto,
    // Sul server non esiste nessuna foto: cosi il primo paint e identico
    // all'idratazione e React non ha niente da riconciliare.
    () => undefined,
  );
  useEffect(() => {
    void leggi();
  }, []);
  return v;
}

/**
 * Cambia la foto (o la toglie, con null). Aggiorna PRIMA lo store e poi il
 * server: il ritaglio l'hai appena confermato tu, e vedere il pallino
 * cambiare dopo mezzo secondo di rete e cio che fa sembrare rotta un'app che
 * funziona. Se il server rifiuta, si torna indietro e si alza l'errore —
 * cosi chi chiama puo dirlo, invece di lasciare un pallino che mente.
 */
export async function salvaFotoProfilo(nuova: string | null): Promise<void> {
  const prima = foto;
  foto = nuova;
  emetti();
  try {
    const resp = await apiFetch("/api/account/avatar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ avatar: nuova }),
    });
    if (!resp.ok) {
      let msg = "";
      try {
        msg = ((await resp.json()) as { error?: string }).error ?? "";
      } catch {
        // Risposta senza corpo JSON: resta il messaggio generico.
      }
      throw new Error(msg || "Salvataggio non riuscito");
    }
  } catch (err) {
    foto = prima;
    emetti();
    throw err;
  }
}

/**
 * Solo per i banchi: riporta lo store allo stato di partenza. Non e esportata
 * dalla porta — non e roba che l'app debba poter fare.
 */
export function _azzeraFotoProfilo(): void {
  foto = undefined;
  lettura = null;
  emetti();
}
