"use client";

/**
 * Il segno di Journal.me, davanti alla scritta.
 *
 * UN FILE SOLO PER TUTTO IL SITO: `public/logo.png`. Chi vuole cambiare il
 * logo sostituisce quel file e basta — rail, splash, login e sblocco
 * cambiano insieme, e non c'e nessun altro posto da ricordarsi. Il percorso
 * sta scritto una volta sola, qui sotto.
 *
 * Perche un componente e non un <img> copiato quattro volte: la scritta
 * "Journal.me" compare in quattro schermate con tipografie diverse (serif
 * 21px nella rail, sans 30px nella splash, 22px in login e sblocco). Con
 * quattro copie, la quinta schermata che nasce si dimentica il logo, e le
 * quattro esistenti divergono al primo ritocco.
 *
 * La misura e in `em` e non in pixel: il segno segue la dimensione del
 * testo accanto a cui sta, quindi funziona in tutte e quattro le schermate
 * senza quattro misure diverse, e segue anche il cursore "Dimensione del
 * testo" delle Impostazioni.
 *
 * Il file e decorativo: la parola "Journal.me" e li accanto, scritta. Per
 * questo `alt=""` e `aria-hidden` — un lettore di schermo che annuncia
 * "logo Journal.me Journal.me" dice la stessa cosa due volte.
 */

/** L'unico percorso del logo in tutto il progetto. */
export const LOGO_SRC = "/logo.png";

export function BrandMark({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={LOGO_SRC}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={className ? `jm-logo ${className}` : "jm-logo"}
    />
  );
}
