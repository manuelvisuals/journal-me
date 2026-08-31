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
import { contattoUrlNoto } from "@/lib/benvenuto-client";
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
  // LA DESTINAZIONE ARRIVA DAL PANNELLO ADMIN, non dal codice: e il campo
  // "Indirizzo della riga in fondo" del Messaggio di benvenuto. Finche e
  // vuoto la linguetta resta un bottone che non apre nulla, esattamente
  // com'era; appena Manuel incolla un indirizzo (il giorno che il sito ha
  // la pagina dei contatti) diventa un link, senza toccare una riga di
  // codice. Un href finto sarebbe una promessa rotta al primo tocco, e il
  // messaggio di benvenuto dice proprio "scrivimi": l'animazione di
  // chiusura vola dentro questa linguetta, quindi e qui che uno ci prova.
  //
  // La lettura e sincrona e senza rete (legge la copia gia in cache): la
  // linguetta non deve MAI accendere una richiesta per conto suo, o in
  // modalita locale la promessa "nemmeno una richiesta" cadrebbe.
  // Si monta solo dentro l'app e dopo l'idratazione (useDentroApp torna
  // false sul server), quindi qui localStorage c'e sempre.
  //
  // Al meccanismo del saluto serve solo un elemento fisso e misurabile con
  // un selettore stabile: la classe resta la stessa in tutti e due i casi.
  const url = contattoUrlNoto();
  if (url === "") {
    return (
      <button type="button" className="jm-benv-ling">
        {t("Feedback")}
      </button>
    );
  }
  // Una pagina del sito si apre dove sei; solo un indirizzo di fuori merita
  // una scheda nuova. Sbattere fuori dall'app chi voleva scrivere due righe
  // sarebbe il modo piu veloce di fargli perdere il filo.
  const fuori = /^https?:/i.test(url);
  return (
    <a
      href={url}
      className="jm-benv-ling"
      {...(fuori ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {t("Feedback")}
    </a>
  );
}
