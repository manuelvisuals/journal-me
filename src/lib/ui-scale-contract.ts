/**
 * Il CONTRATTO della dimensione dell'interfaccia (task del 20 agosto 2026: "non vedo bene e
 * tutto e troppo piccolo per me").
 *
 * PERCHE NON SI INGRANDISCONO SOLO I FONT. In globals.css ci sono 166
 * misure di testo scritte in pixel, e accanto a loro altezze, spaziature e
 * bersagli scritti in pixel. Scalare solo i font vuol dire testo grande
 * dentro righe rimaste piccole: si accavalla. Convertire tutto in rem
 * sarebbe la strada da manuale, ma tocca ogni riga del foglio di stile e
 * ogni componente, e il rischio di rompere qualcosa e alto in confronto al
 * guadagno.
 *
 * Si usa invece `zoom` sulla radice, che ingrandisce testo, spazi e
 * bersagli insieme — che e esattamente cio che serve a chi non vede bene.
 * Provato nel browser vero prima di scriverlo (scripts/verify-testo.mjs):
 * niente sbordamenti orizzontali, gli overlay `position: fixed` continuano
 * a coprire tutto lo schermo, la tab bar resta incollata in fondo.
 *
 * L'UNICA COSA CHE LO ZOOM ROMPE e `100dvh`. Dentro una radice zoomata
 * 100dvh vale il 125% dello schermo, e compare una barra di scorrimento su
 * una pagina vuota. Per questo esiste la classe `.jm-screen`, che al posto
 * di `min-height: 100dvh` scrive `calc(100dvh / var(--jm-ui-scale))`: le
 * tredici schermate a tutta altezza usano quella e non il valore diretto.
 *
 * La scala si applica PRIMA del primo disegno, nello stesso script inline
 * che gia mette tema e chiaro/scuro (src/themes/boot.ts). Applicarla da
 * React vorrebbe dire vedere l'app piccola per un istante e poi saltare.
 */

/*
 * Questo file NON importa React, e per un motivo preciso: lo importa anche
 * `src/themes/boot.ts`, che gira come modulo server per generare lo script
 * inline. Un solo `useSyncExternalStore` qui dentro e Next rifiuta di
 * compilare la pagina. Stessa divisione che i temi hanno gia fra
 * `themes/contract.ts` e `themes/runtime.ts`.
 */

export const UI_SCALE_STORAGE_KEY = "jm:scale";

/** I cinque passi. Il valore E la chiave: niente tabella di conversione. */
export const UI_SCALES = [0.9, 1, 1.15, 1.3, 1.5] as const;
export type UiScale = (typeof UI_SCALES)[number];

export const DEFAULT_UI_SCALE: UiScale = 1;

/** Il nome di ogni passo. */
export const UI_SCALE_LABELS: Record<string, string> = {
  "0.9": "Piccolo",
  "1": "Normale",
  "1.15": "Grande",
  "1.3": "Molto grande",
  "1.5": "Massimo",
};

export function isUiScale(n: number): n is UiScale {
  return (UI_SCALES as readonly number[]).includes(n);
}

/**
 * Applica la scala a <html>. `zoom` fa il lavoro; la custom property serve
 * a `.jm-screen` per correggere 100dvh (vedi la nota in testa al file).
 */
export function applyUiScale(value: number): void {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  el.style.setProperty("--jm-ui-scale", String(value));
  // A 1 lo zoom si toglie invece di scriverlo: una radice senza `zoom` e
  // il caso normale, e non va fatta pagare a chi non usa questa funzione.
  if (value === 1) el.style.removeProperty("zoom");
  else el.style.zoom = String(value);
}
