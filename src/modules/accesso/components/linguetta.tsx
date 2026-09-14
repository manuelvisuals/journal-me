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

import { usePathname } from "next/navigation";
import { useLang, useT } from "@/lib/i18n";
import { contattoUrlNoto } from "@/lib/benvenuto-client";
import { useDentroApp } from "@/components/ui/tab-bar";
import { useRevisore } from "@/modules/accesso/revisore";
import { isNative } from "@/lib/native/platform";
import { destinazioneLinguetta } from "@/modules/accesso/assistenza-url";
import { useEmailInTasca, useVersioneApp } from "@/modules/accesso/assistenza";

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
  // I tre pezzi che la linguetta si porta dietro. Si chiedono SEMPRE, anche
  // quando poi non si montera niente: le regole dei hook non ammettono un
  // "se" davanti, e nessuno dei tre tocca la rete.
  const lingua = useLang();
  const email = useEmailInTasca();
  const versione = useVersioneApp();
  const schermata = usePathname();
  // Sull'account di revisione Apple (appreview@...) la linguetta non c'e:
  // decisione di Manuel del 9 settembre 2026, per gli screenshot dello
  // store e per non mettere un bottone in piu sotto gli occhi del revisore.
  // Il saluto non ne soffre: senza bersaglio ha la chiusura secca.
  const revisore = useRevisore();
  if (!dentro || revisore) return null;
  // LA DESTINAZIONE PUO ARRIVARE DAL PANNELLO ADMIN: e il campo "Indirizzo
  // della riga in fondo" del Messaggio di benvenuto, e quando c'e vince.
  // Quando manca si usa l'assistenza del sito: il messaggio di benvenuto
  // dice proprio "scrivimi", e l'animazione di chiusura del saluto vola
  // dentro questa linguetta, quindi e qui che uno ci prova.
  //
  // La lettura del pannello e sincrona e senza rete (legge la copia gia in
  // cache): la linguetta non deve MAI accendere una richiesta per conto
  // suo, o in modalita locale la promessa "nemmeno una richiesta" cadrebbe.
  // Si monta solo dentro l'app e dopo l'idratazione (useDentroApp torna
  // false sul server), quindi qui localStorage c'e sempre.
  //
  // Al meccanismo del saluto serve solo un elemento fisso e misurabile con
  // un selettore stabile: la classe non cambia mai.
  //
  // DAL 13 SETTEMBRE 2026 LA LINGUETTA PORTA ALL'ASSISTENZA PER DAVVERO.
  // Il pannello vince ancora, ma solo se dice qualcosa di DIVERSO dalle
  // nostre pagine: il valore di fabbrica e gia "/support", cioe un
  // indirizzo nudo che dentro il guscio iOS non esiste nemmeno (li le
  // pagine del sito non entrano nel pacchetto). Quando punta a casa nostra
  // lo rifacciamo noi, con la lingua giusta, il sito intero se siamo nel
  // guscio, e cio che l'app sa gia di chi scrive
  // (modules/accesso/assistenza-url.ts).
  const url = destinazioneLinguetta(contattoUrlNoto(), {
    nativo: isNative(),
    lingua,
    email,
    versione,
    schermata,
  });
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
