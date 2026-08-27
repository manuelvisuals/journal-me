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
import { useDentroApp } from "@/components/ui/tab-bar";

export const SELETTORE_LINGUETTA = ".jm-benv-ling";

export function Linguetta() {
  const t = useT();
  // Solo DENTRO l'app (Manuel, 27 agosto 2026: "quando vedi il dock").
  // Su login, /benvenuto e le pagine pubbliche la linguetta non c'e: il
  // segnale arriva dal dock stesso (segnalaDentroApp in tab-bar.tsx),
  // perche questa DEVE restare montata a livello di body — vedi i vincoli
  // qui sotto — e non puo stare fisicamente accanto alla barra.
  // Il saluto non si rompe quando manca: ha gia la chiusura secca di
  // ripiego (saluto-avvio.tsx), e comunque compare solo da dentro.
  const dentro = useDentroApp();
  if (!dentro) return null;
  // Bottone e non <a> finche la destinazione non e decisa: un href finto
  // sarebbe una promessa rotta al primo tocco. Al meccanismo serve solo un
  // elemento fisso e misurabile con un selettore stabile.
  // Si chiama "Feedback" (deciso da Manuel il 27 agosto 2026) e per ora,
  // sempre per sua scelta, NON apre nulla.
  return (
    <button type="button" className="jm-benv-ling">
      {t("Feedback")}
    </button>
  );
}
