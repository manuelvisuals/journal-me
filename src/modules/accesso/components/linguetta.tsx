"use client";

/**
 * La linguetta sul bordo destro: sempre in vista, su ogni schermata, anche
 * per chi non e entrato.
 *
 * Non e un ornamento: e il BERSAGLIO dell'animazione di chiusura del
 * saluto, che ne misura la posizione reale con getBoundingClientRect. Da
 * qui discendono tre vincoli che non si possono rilassare.
 *
 * 1. Sta FUORI da qualunque antenato con un `transform`. Un antenato
 *    trasformato rende `position: fixed` relativo a se, la linguetta
 *    smette di essere dove sembra, e il messaggio volerebbe nel posto
 *    sbagliato. Per questo si monta a livello di <body>, accanto alla
 *    splash, e non dentro AuthGate o il guscio desktop.
 * 2. Sta SOTTO il velo del saluto: linguetta 1500, velo 2000.
 * 3. E' centrata con translateY(-50%), quindi quel transform va RIPETUTO in
 *    ogni fotogramma della sua animazione, o al primo salta di posto.
 *
 * Il selettore e esportato: e il contratto fra questo pezzo e chi lo cerca.
 */

import { useT } from "@/lib/i18n";

export const SELETTORE_LINGUETTA = ".jm-benv-ling";

export function Linguetta() {
  const t = useT();
  // Bottone e non <a> finche la destinazione non e decisa: un href finto
  // sarebbe una promessa rotta al primo tocco. Al meccanismo serve solo un
  // elemento fisso e misurabile con un selettore stabile.
  return (
    <button type="button" className="jm-benv-ling">
      {t("Scrivimi")}
    </button>
  );
}
