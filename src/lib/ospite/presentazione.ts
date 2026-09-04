/**
 * Il regalo si presenta UNA volta per dispositivo (mockup
 * premium-senza-password, decisione A2 di Manuel del 4 settembre 2026):
 * il foglio "L'AI ha chiuso questa giornata per te" dopo la prima giornata
 * chiusa dall'AI. Qui solo la memoria del "gia fatto": localStorage, come
 * per il saluto di benvenuto. Nessuna rete.
 */
const CHIAVE = "jm.premium.presentato";

export function premiumGiaPresentato(): boolean {
  try {
    return window.localStorage.getItem(CHIAVE) === "1";
  } catch {
    return false;
  }
}

export function segnaPremiumPresentato(): void {
  try {
    window.localStorage.setItem(CHIAVE, "1");
  } catch {
    // niente memoria: vale per questa sessione
  }
}
