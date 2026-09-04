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
};

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
      };
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
