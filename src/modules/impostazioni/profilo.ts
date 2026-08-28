"use client";

/**
 * Il profilo — nome e foto — letto una volta, visto in cinque posti.
 *
 * Il pallino li mostra nell'intestazione del telefono e nella rail del
 * computer (entrambi `AccountMenu`, scheletro), il menu li mostra nella sua
 * testata, e le Impostazioni li mostrano nella colonna destra. Se ognuno se
 * li leggesse per conto suo, dopo un cambio si vedrebbero stati diversi
 * nella stessa schermata finche non si ricarica: per questo vivono in UNO
 * store e chi li mostra si limita a leggerlo.
 *
 * Stanno nel modulo impostazioni — che e chi li sa cambiare — ed escono
 * dalla PORTA (`@/modules/impostazioni`). Lo scheletro importa da li, come
 * gia fa con il muro premium di abbonamento.
 *
 * `undefined` = non ancora letto (il pallino mostra l'iniziale e non
 * lampeggia); `null` = letto, e non c'e.
 */

import { useEffect, useSyncExternalStore } from "react";
import { apiFetch } from "@/lib/api";
import { resolveStorageMode } from "@/lib/data/store";
import {
  nomeMostrato,
  normalizzaNome,
} from "@/modules/impostazioni/profilo-contract";

type Profilo = {
  /** Il nome SCELTO. `null` = nessuno, si ricade sull'email. */
  nome: string | null;
  /** La foto come data URL. `null` = nessuna, resta l'iniziale. */
  foto: string | null;
};

let profilo: Profilo | undefined = undefined;
let lettura: Promise<void> | null = null;
const ascoltatori = new Set<() => void>();

function emetti(): void {
  for (const a of ascoltatori) a();
}

function iscrivi(a: () => void): () => void {
  ascoltatori.add(a);
  return () => ascoltatori.delete(a);
}

const VUOTO: Profilo = { nome: null, foto: null };

/**
 * Legge il profilo. Una volta sola: la promessa resta in mano allo store,
 * cosi cinque componenti montati insieme fanno UNA richiesta, non cinque.
 */
function leggi(): Promise<void> {
  if (lettura) return lettura;
  lettura = (async () => {
    try {
      // In locale non c'e nessun account: e una risposta, non un errore.
      if ((await resolveStorageMode()) === "local") {
        profilo = VUOTO;
        return;
      }
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        profilo = VUOTO;
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("display_name, avatar_data")
        .eq("user_id", user.id)
        .maybeSingle();
      profilo = {
        nome: normalizzaNome(data?.display_name),
        foto: (data?.avatar_data as string | null | undefined) ?? null,
      };
    } catch {
      // Colonne non ancora applicate (migration 016/017 da incollare), rete
      // assente, sessione scaduta: in tutti e tre i casi la risposta giusta
      // e "niente di scelto", non una schermata rotta.
      profilo = VUOTO;
    } finally {
      emetti();
    }
  })();
  return lettura;
}

/** Nome scelto e foto. Chi li usa non deve sapere da dove arrivano. */
export function useProfilo(): Profilo | undefined {
  const v = useSyncExternalStore(
    iscrivi,
    () => profilo,
    // Sul server non c'e nessun profilo: cosi il primo paint e identico
    // all'idratazione e React non ha niente da riconciliare.
    () => undefined,
  );
  useEffect(() => {
    void leggi();
  }, []);
  return v;
}

/**
 * Il nome da mostrare, gia risolto: scelto, oppure l'email tagliata alla
 * chiocciola. Esiste per non far ripetere quel `??` a ogni chiamante — era
 * proprio la duplicazione che faceva comparire due nomi diversi nella
 * stessa schermata.
 */
export function useNomeMostrato(
  email: string | null | undefined,
  ospite = "ospite",
): string {
  const p = useProfilo();
  return nomeMostrato(p?.nome, email, ospite);
}

async function scrivi(rotta: string, corpo: unknown): Promise<void> {
  const resp = await apiFetch(rotta, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(corpo),
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
}

/**
 * Cambia la foto (o la toglie, con null). Aggiorna PRIMA lo store e poi il
 * server: il ritaglio l'hai appena confermato tu, e vedere il pallino
 * cambiare dopo mezzo secondo di rete e cio che fa sembrare rotta un'app
 * che funziona. Se il server rifiuta, si torna indietro e si alza l'errore.
 */
export async function salvaFotoProfilo(nuova: string | null): Promise<void> {
  const prima = profilo;
  profilo = { nome: prima?.nome ?? null, foto: nuova };
  emetti();
  try {
    await scrivi("/api/account/avatar", { avatar: nuova });
  } catch (err) {
    profilo = prima;
    emetti();
    throw err;
  }
}

/** Cambia il nome mostrato (o lo toglie, con null). Stessa regola. */
export async function salvaNomeProfilo(nuovo: string | null): Promise<void> {
  const pulito = normalizzaNome(nuovo);
  const prima = profilo;
  profilo = { nome: pulito, foto: prima?.foto ?? null };
  emetti();
  try {
    await scrivi("/api/account/nome", { nome: pulito });
  } catch (err) {
    profilo = prima;
    emetti();
    throw err;
  }
}

/* =====================================================================
   "Portami alla schermata del nome"
   =====================================================================
   La pennina sta nella testata del menu, che vive nello SCHELETRO
   (account-menu.tsx); la schermata dove si scrive il nome sta qui, dentro
   le Impostazioni. Serviva un modo di dire "aprila" senza passare dai
   parametri dell'indirizzo — che in Next 16 obbligano a un Suspense
   attorno a mezza pagina per una cosa che dura un istante.

   Un contatore e non un booleano: se premi la pennina, torni indietro e la
   premi di nuovo, il valore deve cambiare comunque, o la seconda volta non
   succede niente. */
let richiestaNome = 0;
const richiedenti = new Set<() => void>();

/** Dalla pennina del menu. */
export function apriPannelloNome(): void {
  richiestaNome++;
  for (const r of richiedenti) r();
}

/** Dalle Impostazioni: cambia quando qualcuno ha chiesto di aprirlo. */
export function useRichiestaNome(): number {
  return useSyncExternalStore(
    (l) => {
      richiedenti.add(l);
      return () => richiedenti.delete(l);
    },
    () => richiestaNome,
    () => 0,
  );
}

/** Solo per i banchi: riporta lo store allo stato di partenza. */
export function _azzeraProfilo(): void {
  profilo = undefined;
  lettura = null;
  emetti();
}
