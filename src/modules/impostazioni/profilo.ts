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
 * `undefined` = solo sul server (nessun profilo da disegnare); sul client il
 * primo snapshot viene gia dal locale, sincrono.
 */

import { useEffect, useSyncExternalStore } from "react";
import { apiFetch } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { resolveStorageMode } from "@/lib/data/store";
import {
  nomeMostrato,
  normalizzaNome,
  RIPIEGO_NOME,
} from "@/modules/impostazioni/profilo-contract";

type Profilo = {
  /** Il nome SCELTO. `null` = nessuno, si ricade sull'email. */
  nome: string | null;
  /** La foto come data URL. `null` = nessuna, resta l'iniziale. */
  foto: string | null;
};

/**
 * LA FONTE LOCALE (deciso da Manuel il 7 settembre 2026): nome e foto per
 * tutti, anche da ospite, e condivisi fra i dispositivi con l'account.
 *
 *  - localStorage `jm.profilo` = { nome, foto, daOspite }. Si legge in modo
 *    SINCRONO al primo snapshot sul client: il pallino ha subito la foto,
 *    niente lampeggio dell'iniziale. Sul server lo snapshot resta undefined.
 *  - Da ospite (modalita locale) si legge e scrive SOLO qui, con
 *    daOspite: true.
 *  - Con l'account: salvare = locale (daOspite: false) + le rotte
 *    /api/account/nome e /api/account/avatar; se il POST fallisce si torna
 *    indietro e l'errore va a schermo. Leggere = locale subito, poi UNA
 *    volta per apertura la riga di `profiles`: se il locale porta ancora
 *    daOspite: true, si manda su il locale e si toglie il segno (il nome
 *    scelto da ospite segue la persona); altrimenti il server vince e
 *    aggiorna il locale, anche quando e vuoto: cancellare la foto dal Mac
 *    deve valere anche sul telefono.
 *  - `jm.profilo` si svuota al logout e alla cancellazione dell'account
 *    (svuotaProfilo). Niente migration, niente busta.
 */
type ProfiloLocale = Profilo & { daOspite: boolean };

const CHIAVE_LOCALE = "jm.profilo";

function leggiLocale(): ProfiloLocale | null {
  try {
    const grezzo = window.localStorage.getItem(CHIAVE_LOCALE);
    if (!grezzo) return null;
    const j = JSON.parse(grezzo) as Partial<ProfiloLocale>;
    return {
      nome: normalizzaNome(typeof j.nome === "string" ? j.nome : null),
      foto: typeof j.foto === "string" && j.foto ? j.foto : null,
      daOspite: j.daOspite === true,
    };
  } catch {
    return null;
  }
}

function scriviLocale(p: ProfiloLocale | null): void {
  try {
    if (!p) window.localStorage.removeItem(CHIAVE_LOCALE);
    else window.localStorage.setItem(CHIAVE_LOCALE, JSON.stringify(p));
  } catch {
    // niente memoria: vale per questa sessione
  }
}

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

/** Lo snapshot sul client: la prima volta viene dal locale, subito. */
function snapshot(): Profilo | undefined {
  if (profilo === undefined && typeof window !== "undefined") {
    const l = leggiLocale();
    profilo = l ? { nome: l.nome, foto: l.foto } : VUOTO;
  }
  return profilo;
}

function stesso(a: Profilo, b: Profilo): boolean {
  return a.nome === b.nome && a.foto === b.foto;
}

/**
 * La riconciliazione con l'account. Una volta sola per apertura: la
 * promessa resta in mano allo store, cosi cinque componenti montati insieme
 * fanno UNA lettura, non cinque. Da ospite non parte nessuna richiesta.
 */
function leggi(): Promise<void> {
  if (lettura) return lettura;
  vedetta();
  lettura = (async () => {
    try {
      snapshot();
      /* Le uscite anticipate NON si ricordano (bug del 9 settembre 2026:
         sul telefono, dopo logout e login, la foto restava sparita per
         minuti). Una lettura che non ha letto niente — modalita locale,
         nessun utente ancora, rete storta — non e "fatta": il prossimo
         componente che monta deve poter riprovare. Solo la riga di
         `profiles` letta davvero chiude la partita per questa apertura. */
      if ((await resolveStorageMode()) === "local") {
        lettura = null;
        return;
      }
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        lettura = null;
        return;
      }
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, avatar_data")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) {
        lettura = null;
        return;
      }
      const server: Profilo = {
        nome: normalizzaNome(data?.display_name),
        foto: (data?.avatar_data as string | null | undefined) ?? null,
      };
      const locale = leggiLocale();
      if (locale?.daOspite) {
        // Il nome e la foto scelti da ospite seguono la persona: salgono
        // una volta, poi il segno si toglie. Se un POST fallisce il segno
        // resta e si riprova alla prossima apertura.
        const unito: Profilo = { nome: locale.nome ?? server.nome, foto: locale.foto ?? server.foto };
        try {
          if (locale.nome !== null) await scrivi("/api/account/nome", { nome: locale.nome });
          if (locale.foto !== null) await scrivi("/api/account/avatar", { avatar: locale.foto });
        } catch {
          profilo = unito;
          return;
        }
        profilo = unito;
        scriviLocale({ ...unito, daOspite: false });
        return;
      }
      // Il server vince, anche vuoto.
      if (!profilo || !stesso(profilo, server)) profilo = server;
      scriviLocale({ ...server, daOspite: false });
    } catch {
      // Rete assente, sessione scaduta, colonne mancanti: resta il locale,
      // e si riprovera al prossimo montaggio.
      lettura = null;
    } finally {
      emetti();
    }
  })();
  return lettura;
}

/**
 * La vedetta sull'accesso: a un login nuovo (SIGNED_IN) la lettura di
 * questa apertura non vale piu — e di un'altra persona, o di nessuno — e
 * si rifa subito. Il logout la azzera gia da solo (svuotaProfilo). Una
 * volta per pagina.
 */
let vedettaAccesa = false;
function vedetta(): void {
  if (vedettaAccesa || typeof window === "undefined") return;
  vedettaAccesa = true;
  void import("@/lib/supabase/client").then(({ createClient }) => {
    createClient().auth.onAuthStateChange((evento) => {
      if (evento !== "SIGNED_IN") return;
      lettura = null;
      void leggi();
    });
  });
}

/** Nome scelto e foto. Chi li usa non deve sapere da dove arrivano. */
export function useProfilo(): Profilo | undefined {
  const v = useSyncExternalStore(
    iscrivi,
    snapshot,
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
export function useNomeMostrato(email: string | null | undefined): string {
  const p = useProfilo();
  const t = useT();
  // Senza nome scelto e senza email la casella dice "Il tuo nome"
  // (RIPIEGO_NOME, tradotto qui e in nessun altro posto).
  return nomeMostrato(p?.nome, email, t(RIPIEGO_NOME));
}

/** Al logout e alla cancellazione dell'account: il prossimo e un altro. */
export function svuotaProfilo(): void {
  scriviLocale(null);
  profilo = VUOTO;
  lettura = null;
  emetti();
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
 * Salva nome e foto: PRIMA lo store e il locale, poi (con l'account) il
 * server. Il ritaglio l'hai appena confermato tu, e vedere il pallino
 * cambiare dopo mezzo secondo di rete e cio che fa sembrare rotta un'app
 * che funziona. Se il server rifiuta, si torna indietro e si alza l'errore.
 */
async function salva(nuovo: Profilo, rotta: string, corpo: unknown): Promise<void> {
  const prima = snapshot() ?? VUOTO;
  const primaLocale = leggiLocale();
  const locale = (await resolveStorageMode()) === "local";
  profilo = nuovo;
  scriviLocale({ ...nuovo, daOspite: locale ? true : (primaLocale?.daOspite ?? false) });
  emetti();
  if (locale) return;
  try {
    await scrivi(rotta, corpo);
  } catch (err) {
    profilo = prima;
    scriviLocale(primaLocale);
    emetti();
    throw err;
  }
}

/** Cambia la foto (o la toglie, con null). */
export async function salvaFotoProfilo(nuova: string | null): Promise<void> {
  const p = snapshot() ?? VUOTO;
  await salva({ nome: p.nome, foto: nuova }, "/api/account/avatar", { avatar: nuova });
}

/** Cambia il nome mostrato (o lo toglie, con null). Stessa regola. */
export async function salvaNomeProfilo(nuovo: string | null): Promise<void> {
  const pulito = normalizzaNome(nuovo);
  const p = snapshot() ?? VUOTO;
  await salva({ nome: pulito, foto: p.foto }, "/api/account/nome", { nome: pulito });
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
