/**
 * L'interruttore dell'ospite sul dispositivo (SPEC-ospite-e-cassaforte R1-R3).
 *
 * La parte invisibile dell'ospite (braccialetto, guardia, quota, tetto) e
 * costruita e provata; le SCHERMATE aspettano l'ok di Manuel sul mockup
 * ospite-primo-avvio.html (SPEC par. 9). Finche l'ok non c'e, l'app deve
 * comportarsi esattamente come prima: per questo il valore di fabbrica e
 * spento. I banchi lo accendono con localStorage `jm.ospite = "1"`; quando
 * arriva l'ok, si porta OSPITE_DI_FABBRICA a true e le schermate entrano.
 */

export const OSPITE_DI_FABBRICA = false;

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
