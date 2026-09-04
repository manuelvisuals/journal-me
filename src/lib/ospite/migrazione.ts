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
import { forcePlanRefresh } from "@/lib/plan";
import { dimenticaPremiumDispositivo } from "@/lib/ospite/stato";

const CHIAVE = "jm.migrazione.locale";

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
    // Da ora il premium (se c'era) e dell'account: il telefono non ne ha uno suo.
    dimenticaPremiumDispositivo();
    if (premiumSpostato) void forcePlanRefresh();

    // 2. Le giornate salgono, chiuse a chiave.
    const locale = new LocalStore();
    const cloud = getStore();
    if (cloud instanceof LocalStore) return;
    const file = await locale.exportAll();
    const report = await cloud.importAll(file);
    esito = { giornate: report.entries.added, premiumSpostato };
    fatto();
  })().finally(() => {
    inCorso = null;
  });
  await inCorso;
  return esito;
}
