"use client";

/**
 * Lo stato del regalo AI visto dal dispositivo (SPEC R2-R3; mockup
 * ospite-primo-avvio.html, schermate 02 e 04, approvato da Manuel il 4
 * settembre 2026).
 *
 * Il dispositivo NON conta niente: chiede al server (/api/ospite/stato,
 * nell'elenco chiuso della promessa sulla rete) quante giornate ha usato
 * questo braccialetto e quante ne restano. Lo chiede poco: una volta
 * all'apertura di chi lo guarda, e di nuovo quando l'AI ha lavorato
 * (aggiornaStatoOspite) o quando il server ha detto "regalo finito".
 *
 * Chi lo legge: l'avviso discreto sotto la giornata chiusa (02), la riga
 * "AI in regalo" di Impostazioni (04), la vista gratis della giornata a
 * regalo finito (03). Nessuno di loro parte se l'ospite e spento o se non
 * siamo in modalita locale: un account cloud non ha un regalo.
 */
import { useEffect, useSyncExternalStore } from "react";
import { apiFetch } from "@/lib/api";
import { ospiteAttivo } from "@/lib/ospite/flag";

export type StatoOspite = {
  attivo: boolean;
  max: number;
  sopraIlTetto: boolean;
  annualeAttivo: boolean;
  usate: number;
  rimaste: number;
  /** La giornata di oggi e gia coperta (una riga esiste): l'AI lavora anche a quota zero (R4). */
  oggi: boolean;
  /** Il premium comprato senza email, sul braccialetto (migration 025): la scadenza, o null. */
  premiumFino: string | null;
};

/**
 * IL PREMIUM SUL DISPOSITIVO (mockup premium-senza-password, B1). Il server
 * lo dice in /api/ospite/stato e in /api/apple/verifica; qui si ricorda la
 * scadenza in localStorage per non far lampeggiare i lucchetti all'avvio
 * e per non chiamare la rete solo per saperlo. La decisione vera resta al
 * server (402), come per il piano dell'account (plan.ts).
 */
const CHIAVE_PREMIUM = "jm.premium.dispositivo";
let premiumFinoInMemoria: string | null | undefined;

function leggiPremiumCache(): string | null {
  if (premiumFinoInMemoria !== undefined) return premiumFinoInMemoria;
  try {
    premiumFinoInMemoria = window.localStorage.getItem(CHIAVE_PREMIUM);
  } catch {
    premiumFinoInMemoria = null;
  }
  return premiumFinoInMemoria;
}

/** Scrive la scadenza (o null) e avvisa chi ascolta. */
export function setPremiumDispositivo(fino: string | null): void {
  premiumFinoInMemoria = fino;
  try {
    if (fino) window.localStorage.setItem(CHIAVE_PREMIUM, fino);
    else window.localStorage.removeItem(CHIAVE_PREMIUM);
  } catch {
    // niente memoria: vale per questa sessione
  }
  avvisa();
}

/** La scadenza del premium sul dispositivo, se e ancora valido. */
export function premiumDispositivoFino(): string | null {
  if (typeof window === "undefined") return null;
  const f = leggiPremiumCache();
  if (!f) return null;
  const t = Date.parse(f);
  return Number.isFinite(t) && t > Date.now() ? f : null;
}

export function premiumDispositivo(): boolean {
  return premiumDispositivoFino() !== null;
}

/** Reattivo: vero finche il premium sul dispositivo e valido. */
export function usePremiumDispositivo(): boolean {
  return useSyncExternalStore(ascolta, premiumDispositivo, () => false);
}

/** Al logout / cambio account: il dispositivo non ha piu un premium suo. */
export function dimenticaPremiumDispositivo(): void {
  setPremiumDispositivo(null);
}

let stato: StatoOspite | null = null;
let inCorso: Promise<StatoOspite | null> | null = null;
const ascoltatori = new Set<() => void>();

function avvisa(): void {
  for (const f of ascoltatori) f();
}

function leggiStato(): StatoOspite | null {
  return stato;
}

function ascolta(f: () => void): () => void {
  ascoltatori.add(f);
  return () => {
    ascoltatori.delete(f);
  };
}

/** Rilegge dal server. Torna null se il server non risponde o l'ospite e spento. */
export async function aggiornaStatoOspite(): Promise<StatoOspite | null> {
  if (typeof window === "undefined" || !ospiteAttivo()) return null;
  if (inCorso) return inCorso;
  inCorso = (async () => {
    try {
      const resp = await apiFetch("/api/ospite/stato", { method: "GET" });
      if (!resp.ok) return stato;
      const j = (await resp.json()) as Partial<StatoOspite>;
      if (typeof j.max !== "number" || typeof j.rimaste !== "number") return stato;
      stato = {
        attivo: j.attivo === true,
        max: j.max,
        sopraIlTetto: j.sopraIlTetto === true,
        annualeAttivo: j.annualeAttivo === true,
        usate: typeof j.usate === "number" ? j.usate : 0,
        rimaste: j.rimaste,
        oggi: j.oggi === true,
        premiumFino: typeof j.premiumFino === "string" ? j.premiumFino : null,
      };
      // Il server e la verita anche sul premium del dispositivo.
      premiumFinoInMemoria = stato.premiumFino;
      try {
        if (stato.premiumFino) window.localStorage.setItem(CHIAVE_PREMIUM, stato.premiumFino);
        else window.localStorage.removeItem(CHIAVE_PREMIUM);
      } catch {
        // niente memoria
      }
      avvisa();
      return stato;
    } catch {
      return stato;
    } finally {
      inCorso = null;
    }
  })();
  return inCorso;
}

/** L'ultimo stato letto, senza chiedere niente. */
export function statoOspiteInTasca(): StatoOspite | null {
  return stato;
}

/**
 * Il regalo e finito per questo dispositivo? Vero quando non resta nessuna
 * giornata, o il regalo e spento, o il tetto del mese e passato (R4: chi ha
 * gia una riga per oggi la finisce, e lo dice `oggi`).
 */
export function regaloFinito(s: StatoOspite | null): boolean {
  if (!s) return false;
  if (s.oggi) return false;
  return !s.attivo || s.sopraIlTetto || s.rimaste <= 0;
}

/**
 * Lo stato per i componenti. `vivo` = vale la pena chiederlo (modalita
 * locale con l'ospite acceso): fuori da li non parte nessuna richiesta.
 */
export function useStatoOspite(vivo: boolean): StatoOspite | null {
  const s = useSyncExternalStore(ascolta, leggiStato, () => null);
  // La prima lettura: una volta per dispositivo, e solo se serve.
  useEffect(() => {
    if (vivo && stato === null) void aggiornaStatoOspite();
  }, [vivo]);
  return vivo ? s : null;
}

if (typeof window !== "undefined") {
  // Il server ha appena detto "regalo finito": lo stato in tasca e vecchio.
  window.addEventListener("jm:regalo-finito", () => {
    void aggiornaStatoOspite();
  });
}
