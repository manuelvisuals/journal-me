"use client";

/**
 * L'ospite mette l'email: le giornate scritte sul telefono SALGONO
 * (mockup premium-senza-password, C1, 4 settembre 2026; SPEC R5), e il
 * braccialetto si lega all'account, portando con se il premium comprato
 * senza email (migration 025, /api/ospite/adotta).
 *
 * COME. Il login lascia un promemoria (segnaMigrazioneDaFare) perche in
 * quel momento la cassaforte non esiste ancora: le giornate devono entrare
 * gia chiuse a chiave, e la chiave nasce al cancello. Il cancello
 * (auth-gate), appena la cassaforte e "aperta", chiama migraSePromesso():
 * legge tutto dallo store locale (exportAll: lo stesso file del backup) e lo
 * importa nello store cloud (importAll: ogni giornata entra nella
 * cassettina, cifrata). Una giornata gia presente sul cloud non si tocca.
 * Le giornate locali NON si cancellano: sono la copia di sicurezza finche
 * la persona non decide altrimenti.
 *
 * Idempotente: il promemoria cade solo a fine riuscita; se l'app muore a
 * meta, al prossimo avvio riparte e importAll salta cio che c'e gia.
 */
import { apiFetch } from "@/lib/api";
import { getStore } from "@/lib/data/store";
import { LocalStore } from "@/lib/data/store/local";
import { eDiFabbrica } from "@/lib/data/store/default-goals";
import { forcePlanRefresh } from "@/lib/plan";
import { utenteDalDispositivo } from "@/lib/supabase/client";

const CHIAVE = "jm.migrazione.locale";
/**
 * GLI ACCOUNT IN CUI QUESTO DISPOSITIVO HA GIA VERSATO (11 settembre 2026,
 * Manuel: "rimuovo dei goal dalle impostazioni e poi riappaiono sempre").
 *
 * Il promemoria `jm.migrazione.locale` lo rimette OGNI login fatto da un
 * dispositivo in modalita locale — ed e giusto, perche il login non sa se
 * la migrazione e gia stata fatta. Ma senza memoria di cio che e gia
 * salito, ogni login rifaceva la salita: le giornate no (importAll salta
 * quelle che ci sono), ma gli OBIETTIVI cancellati a mano dalle
 * Impostazioni tornavano su dal telefono, ogni volta, come funghi. Da qui
 * l'elenco degli account gia serviti: un dispositivo versa in un account
 * UNA volta sola.
 */
const CHIAVE_FATTA = "jm.migrazione.fatta";

function serviti(): string[] {
  try {
    return (window.localStorage.getItem(CHIAVE_FATTA) ?? "").split(",").filter(Boolean);
  } catch {
    return [];
  }
}

function giaServito(utente: string | null): boolean {
  return !!utente && serviti().includes(utente);
}

function segnaServito(utente: string | null): void {
  if (!utente) return;
  try {
    const tutti = [...new Set([...serviti(), utente])].slice(-8);
    window.localStorage.setItem(CHIAVE_FATTA, tutti.join(","));
  } catch {
    // senza memoria si rifara: e il comportamento di prima, non peggio
  }
}

export function segnaMigrazioneDaFare(): void {
  try {
    window.localStorage.setItem(CHIAVE, "1");
  } catch {
    // niente memoria: si fara comunque adesso, in questa sessione
  }
  daFareInMemoria = true;
}

let daFareInMemoria = false;
let inCorso: Promise<void> | null = null;

function daFare(): boolean {
  if (daFareInMemoria) return true;
  try {
    return window.localStorage.getItem(CHIAVE) === "1";
  } catch {
    return false;
  }
}

function fatto(): void {
  daFareInMemoria = false;
  try {
    window.localStorage.removeItem(CHIAVE);
  } catch {
    // niente
  }
}

export type EsitoMigrazione = { giornate: number; premiumSpostato: boolean } | null;

/**
 * Da chiamare quando la sessione cloud c'e e la cassaforte e aperta.
 * Torna null se non c'era niente da fare.
 */
export async function migraSePromesso(): Promise<EsitoMigrazione> {
  if (!daFare()) return null;
  // Questo dispositivo ha gia versato in questo account: non si rifa.
  const utente = utenteDalDispositivo();
  if (giaServito(utente)) {
    fatto();
    return null;
  }
  if (inCorso) {
    await inCorso;
    return null;
  }
  let esito: EsitoMigrazione = null;
  inCorso = (async () => {
    // 1. Il braccialetto si lega all'account (e il premium passa).
    let premiumSpostato = false;
    try {
      const r = await apiFetch("/api/ospite/adotta", { method: "POST" });
      if (r.ok) {
        const j = (await r.json()) as { premium_spostato?: boolean };
        premiumSpostato = j.premium_spostato === true;
      }
    } catch {
      // senza rete si riprova al prossimo avvio: il promemoria resta
      return;
    }
    // Se il braccialetto portava un premium comprato senza email (prima del
    // 10 settembre 2026), adotta_braccialetto l'ha appena messo sul profilo:
    // il piano si rilegge, e da qui in poi vale su ogni dispositivo.
    if (premiumSpostato) void forcePlanRefresh();

    // 2. Le giornate salgono, chiuse a chiave.
    const locale = new LocalStore();
    const cloud = getStore();
    if (cloud instanceof LocalStore) return;
    const file = await locale.exportAll();
    /* GLI OBIETTIVI DI FABBRICA NON SALGONO. Quelli del telefono sono la
       stessa lista che il server ha gia dato all'account appena nato
       (default-goals.ts, nella lingua del dispositivo; dal 12 settembre
       2026 li semina la rotta del seme, non piu il trigger): farli
       salire vuol dire riscrivere sul cloud sei righe che ci sono gia, o —
       se la persona nel frattempo le ha tolte dalle Impostazioni —
       RIMETTERLE. Cio che la persona ha aggiunto di suo sale, perche
       quello e suo. */
    // In tutte e due le lingue (12 settembre 2026): il telefono inglese ha
    // "moved my body", e sul cloud l'account appena nato li riceve nella
    // stessa lingua dalla rotta del seme.
    const suoi = {
      ...file,
      goals: (file.goals ?? []).filter((g) => !eDiFabbrica(g.label)),
    };
    const report = await cloud.importAll(suoi);
    esito = { giornate: report.entries.added, premiumSpostato };
    segnaServito(utente);
    fatto();
  })().finally(() => {
    inCorso = null;
  });
  await inCorso;
  return esito;
}
