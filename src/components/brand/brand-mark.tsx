"use client";

/**
 * IL SEGNO DI DAYALOGUE: la "d" con i tre pallini, cioe ESATTAMENTE il
 * simbolo dell'icona sulla home del telefono (scelta 1B di Manuel, 11
 * settembre 2026, sera).
 *
 * Prima qui c'era `public/logo.png`: il ghirigoro calligrafico, una
 * fotografia di un disegno. Due difetti, e tutti e due si vedevano: una
 * immagine di pixel che su uno schermo a tre volte la densita si ammorbidisce
 * ai bordi, e un marchio DIVERSO da quello che la persona tocca sulla home.
 * Chi apre l'app deve ritrovare la faccia che ha appena toccato: e cosi che
 * un'app diventa riconoscibile.
 *
 * PERCHE SVG SCRITTO QUI DENTRO e non un <img src="/marchio.svg">: un file
 * caricato come immagine non eredita i colori della pagina. Il segno invece
 * deve seguire il tema — la "d" prende `currentColor` (quindi il colore del
 * testo accanto a cui sta, in tutti e cinque i temi, in chiaro e in scuro) e
 * i pallini prendono l'accento del tema. Prima questo si otteneva con
 * `filter: invert(1) hue-rotate(180deg)` sul buio: un trucco che ribaltava
 * anche il terracotta dei pallini, facendolo diventare azzurrino.
 *
 * Il disegno e lo stesso file dell'icona (design/immagini/icona-app.svg):
 * stesso tracciato, stessa posizione dei pallini, senza il quadrato di
 * fondo. La cornice e stretta attorno al segno (viewBox misurata, non a
 * occhio), cosi l'altezza in `em` vale davvero quello che dice.
 */

/** La cornice: misurata sul disegno vero, non stimata. */
const VIEW_BOX = "358.8 243.7 306.4 536.6";

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox={VIEW_BOX}
      className={className ? `jm-logo ${className}` : "jm-logo"}
      aria-hidden="true"
      focusable="false"
    >
      <g transform="translate(338.65 656.68) scale(0.28796 -0.28796)">
        <path fill="currentColor" d="M752 611Q752 697 705.5 750.0Q659 803 564 803Q490 803 437.5 765.0Q385 727 357.0 650.0Q329 573 329 458Q329 347 359.0 273.5Q389 200 443.5 164.0Q498 128 573 128Q632 128 691.0 145.5Q750 163 806 200V122Q735 77 684.5 48.0Q634 19 596.0 3.5Q558 -12 525.5 -18.0Q493 -24 461 -24Q333 -24 245.5 29.5Q158 83 114.0 179.0Q70 275 70 401Q70 524 111.0 619.5Q152 715 223.5 780.5Q295 846 386.5 880.0Q478 914 578 914Q633 914 683.5 905.5Q734 897 786.5 879.5Q839 862 900 832L752 799V1203Q738 1219 715.0 1234.0Q692 1249 664.0 1263.5Q636 1278 603 1293V1338L977 1434H1012L997 1230V178Q1007 167 1023.0 156.0Q1039 145 1058.0 133.5Q1077 122 1096.5 113.5Q1116 105 1134 99V59L817 -23H785L752 147Z" />
      </g>
      <g fill="var(--color-accent)">
        <circle cx="396.3" cy="745.5" r="34.8" />
        <circle cx="512" cy="745.5" r="34.8" />
        <circle cx="627.7" cy="745.5" r="34.8" />
      </g>
    </svg>
  );
}
