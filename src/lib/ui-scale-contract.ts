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
 * PRIMA VERSIONE, SCARTATA: `zoom` sulla radice. Ingrandiva tutto insieme
 * — testo, spazi, margini — e funzionava, ma non era cio che serviva:
 * crescendo anche i margini laterali, sullo schermo entrava la stessa
 * quantita di parole di prima, solo piu grosse. Manuel l'ha visto subito
 * ("il gap destra e sinistra cambia, volevo solo il font") e ha ragione:
 * chi ingrandisce il testo lo fa per LEGGERE DI PIU, non per vedere gli
 * stessi margini piu larghi.
 *
 * VERSIONE ATTUALE: si scala SOLO la dimensione del testo. Ogni misura di
 * testo del progetto — 175 in globals.css, 14 dai token dei temi, 37 negli
 * stili inline, 9 nelle classi Tailwind — e scritta come
 * `calc(<valore> * var(--jm-ui-scale))`. Margini, spaziature e larghezze
 * restano quelle: il testo cresce dentro lo spazio che c'e gia, e sullo
 * schermo entra piu roba leggibile.
 *
 * Le altezze minime sono `min-height` e non `height`, quindi le righe si
 * allargano da sole quando il testo dentro cresce.
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

/**
 * Il passo di partenza, spostato da 1 a 1,15 il 22 agosto 2026 su richiesta
 * di Manuel. Non e un ritocco di etichette: chi non ha mai scelto niente
 * vede l'app un passo piu grande di prima. E la misura che lui usa davvero,
 * e questa app ha un utente che non vede bene da vicino — partire dal
 * minimo leggibile e piu onesto che partire dal piu compatto.
 */
export const DEFAULT_UI_SCALE: UiScale = 1.15;

/** Il nome di ogni passo. */
/**
 * I nomi sono scalati di un passo (22 agosto 2026): quello che si chiamava
 * "Grande" adesso si chiama "Normale" ed e il default. I VALORI non sono
 * cambiati, solo i nomi e il punto di partenza — chi aveva gia scelto una
 * misura continua a vedere esattamente quella, con un nome diverso accanto.
 */
export const UI_SCALE_LABELS: Record<string, string> = {
  "0.9": "Molto piccolo",
  "1": "Piccolo",
  "1.15": "Normale",
  "1.3": "Grande",
  "1.5": "Molto grande",
};

export function isUiScale(n: number): n is UiScale {
  return (UI_SCALES as readonly number[]).includes(n);
}

/**
 * Applica la scala a <html>: una custom property, e basta. Il CSS la
 * moltiplica dentro ogni misura di testo.
 */
export function applyUiScale(value: number): void {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty("--jm-ui-scale", String(value));
}
