/**
 * IL MURO CHE SI RIAPRE DOPO L'EMAIL (audit del 10 settembre 2026, C1).
 *
 * L'ospite tocca "Passa a premium", il muro gli dice che premium vuole un
 * account e lo manda a /login. Fino a oggi, dopo il codice, il prezzo lo
 * trovava perche /benvenuto (il bivio) glielo rimetteva davanti. Con il
 * bivio che sparisce (punto 7 del modello) atterrerebbe su Oggi a mani
 * vuote, nel momento con la piu alta intenzione d'acquisto di tutto il
 * flusso. Quindi il muro lascia qui un promemoria PRIMA del login, e il
 * cancello (auth-gate), appena la persona e dentro in cloud con la
 * cassaforte aperta, lo legge e riapre il muro: che adesso e in cloud e
 * mostra le schede con il prezzo di Apple.
 *
 * localStorage e la memoria giusta: vale per questo dispositivo, sopravvive
 * al giro di /login (che e una navigazione client, ma anche a un ricarico),
 * e si consuma una volta. "Non ora" dal login lo cancella: chi torna
 * indietro non voleva comprare.
 */
const CHIAVE = "jm.muro.riapri";

export type FeatureDaRiaprire = "voice" | "aiSummary" | "recap" | "patterns" | "regalo";

export function segnaMuroDaRiaprire(feature: FeatureDaRiaprire): void {
  try {
    window.localStorage.setItem(CHIAVE, feature);
  } catch {
    // senza memoria il muro non si riapre: Impostazioni resta la strada
  }
}

/** Legge E consuma il promemoria: chi lo legge deve riaprire il muro. */
export function prendiMuroDaRiaprire(): FeatureDaRiaprire | null {
  try {
    const v = window.localStorage.getItem(CHIAVE);
    if (!v) return null;
    window.localStorage.removeItem(CHIAVE);
    return ["voice", "aiSummary", "recap", "patterns", "regalo"].includes(v) ? (v as FeatureDaRiaprire) : "aiSummary";
  } catch {
    return null;
  }
}

export function dimenticaMuroDaRiaprire(): void {
  try {
    window.localStorage.removeItem(CHIAVE);
  } catch {
    // niente da dimenticare
  }
}
