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

/**
 * PROVA DELL'11 SETTEMBRE 2026, sera (Manuel: "solo i tre punti terracotta
 * senza la d"). La cornice e stretta attorno ai soli pallini, con un
 * respiro di mezzo raggio ai lati: il segno diventa una riga di tre punti,
 * larga e bassa, e va misurata in larghezza e non in altezza.
 */
/** La cornice: misurata sul disegno vero, non stimata. */
const VIEW_BOX = "355.5 706.7 316.9 77.6";

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox={VIEW_BOX}
      className={className ? `jm-logo ${className}` : "jm-logo"}
      aria-hidden="true"
      focusable="false"
    >
      <g fill="var(--color-accent)">
        <circle cx="396.3" cy="745.5" r="34.8" />
        <circle cx="512" cy="745.5" r="34.8" />
        <circle cx="627.7" cy="745.5" r="34.8" />
      </g>
    </svg>
  );
}
