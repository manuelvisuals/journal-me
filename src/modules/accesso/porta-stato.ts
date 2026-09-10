/**
 * La PORTA DEL GIORNO: la logica, senza React e senza import, cosi un banco
 * la esegue in Node (come profilo-contract.ts).
 *
 * Decisione di Manuel del 10 settembre 2026 (audit del modello premium,
 * B1 + 5A + C4, poi "vai, facciamo tutto"): all'ingresso c'e UNA schermata
 * sola, una volta al giorno, alla prima apertura della giornata. Prima ce
 * n'erano tre in coda: il saluto a ogni apertura, il foglio "l'AI ha chiuso
 * questa giornata per te" dopo la prima giornata AI, e la schermata
 * quotidiana del regalo ancora da fare. Ora la stessa porta cambia
 * CONTENUTO, non numero:
 *
 *   lettera    il primo avvio su questo dispositivo (o una lettera riscritta
 *              dal pannello: `versione` nuova): il regalo e la lettera di
 *              Manuel insieme, "Comincia a scrivere", "Ho gia un account";
 *   cambiata   il conto delle giornate e diverso dall'ultima volta che lo si
 *              e detto, o ne restano due o meno: il numero grande;
 *   uguale     il conto non e cambiato (ha scritto a mano, o non ha scritto):
 *              il numero non e il titolo, e il giorno; la stessa frase per
 *              trenta mattine di fila era il problema 2 dell'audit;
 *   finite     le giornate sono zero: "resta tutto, si scrive a mano";
 *   pausa      il regalo e sopra il tetto del mese o spento dal pannello: le
 *              giornate NON sono finite e la porta non deve dire che lo sono
 *              (C4);
 *   proposta   un account gratis senza regalo qui (il web, dove il regalo
 *              non c'e): la proposta di premium che prima viveva nel bivio;
 *   niente     premium, oppure gia mostrata oggi, oppure dopo un logout.
 *
 * Le memorie (localStorage, per dispositivo):
 *   jm.porta.lettera   la versione della lettera gia vista;
 *   jm.porta.giorno    il giorno (locale, del dispositivo) in cui la porta
 *                      e gia stata mostrata;
 *   jm.porta.rimaste   il conto detto l'ultima volta (per "cambiata").
 */

export type VariantePorta =
  | "lettera"
  | "cambiata"
  | "uguale"
  | "finite"
  | "pausa"
  | "proposta"
  | "niente";

export type StatoPerPorta = {
  /** Il giorno di oggi sul dispositivo, YYYY-MM-DD. */
  oggi: string;
  /** La versione corrente della lettera (pannello admin). */
  versioneLettera: number;
  /** Cosa c'e in memoria. */
  memoria: { lettera: number | null; giorno: string | null; rimaste: number | null };
  /** Dopo "Esci dall'account" su questo dispositivo: la porta tace. */
  dopoUscita: boolean;
  /** "local" = ospite, "cloud" = con account. */
  modalita: "local" | "cloud";
  /** Il piano dell'account, se in cloud e noto. */
  premium: boolean;
  /** Il regalo, come lo dice il server; null se non ancora letto. */
  regalo: {
    attivo: boolean;
    sopraIlTetto: boolean;
    rimaste: number;
    max: number;
    registrato: boolean;
  } | null;
};

/** Da quante giornate in giu il numero torna grande anche se non e cambiato. */
export const SOGLIA_POCHE = 2;

export function variantePorta(s: StatoPerPorta): VariantePorta {
  if (s.dopoUscita) return "niente";
  // La lettera: una volta per dispositivo e per versione, prima di tutto il
  // resto. Non ha bisogno del server.
  if (s.memoria.lettera !== s.versioneLettera) return "lettera";
  if (s.memoria.giorno === s.oggi) return "niente";
  if (s.modalita === "cloud" && s.premium) return "niente";
  // Il conto viene dal server: finche non c'e, non si decide (chi chiama
  // aspetta e riprova; un dispositivo senza rete non vede la porta oggi).
  if (!s.regalo) return "niente";
  if (!s.regalo.registrato) return s.modalita === "cloud" ? "proposta" : "niente";
  if (s.regalo.rimaste <= 0) return "finite";
  if (!s.regalo.attivo || s.regalo.sopraIlTetto) return "pausa";
  if (s.memoria.rimaste === null || s.memoria.rimaste !== s.regalo.rimaste) return "cambiata";
  if (s.regalo.rimaste <= SOGLIA_POCHE) return "cambiata";
  return "uguale";
}

/** Il giorno di oggi sul DISPOSITIVO (non a Roma: e la mattina della persona). */
export function giornoLocale(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const g = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${g}`;
}
