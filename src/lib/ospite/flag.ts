/**
 * L'interruttore dell'ospite sul dispositivo (SPEC-ospite-e-cassaforte R1-R3).
 *
 * ACCESO DI FABBRICA dal 4 settembre 2026: Manuel ha approvato le
 * schermate del mockup ospite-primo-avvio.html (tutte le proposte in
 * verde della sezione 07). Chi apre l'app senza account entra dritto su
 * Oggi come ospite (auth-gate), con l'AI in regalo a giornate contate dal
 * server. I banchi possono spegnerlo con localStorage `jm.ospite = "0"`
 * per provare il locale "puro" di prima (verify-rete-spenta).
 */

export const OSPITE_DI_FABBRICA = true;

const CHIAVE = "jm.ospite";

export function ospiteAttivo(): boolean {
  try {
    const v = window.localStorage.getItem(CHIAVE);
    if (v === "1") return true;
    if (v === "0") return false;
  } catch {
    // niente localStorage: vale la fabbrica
  }
  return OSPITE_DI_FABBRICA;
}
