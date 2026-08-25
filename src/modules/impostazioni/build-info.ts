/**
 * Quale build sto guardando.
 *
 * `Versione` (APP_VERSION) e un numero scritto a mano: dice a che punto e il
 * prodotto, non quale codice hai davvero addosso. Serviva una seconda riga
 * che risponda alla domanda vera — "l'app sul telefono ha gia le novita di
 * oggi?" — senza doverla dedurre guardando se una funzione c'e o non c'e.
 *
 * Il valore si cuoce dentro il pacchetto al momento della build:
 *  - guscio iOS: NEXT_PUBLIC_BUILD, messa dallo script che ricostruisce il
 *    bundle sul Mac (commit corto + data);
 *  - Vercel: NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA, che Vercel espone da se.
 *
 * Se non c'e nessuna delle due si sta girando col server di sviluppo, e
 * dirlo e piu onesto che mostrare una stringa vuota.
 */

const GREZZO =
  process.env.NEXT_PUBLIC_BUILD ||
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
  "";

export const BUILD_INFO = GREZZO ? GREZZO.slice(0, 40) : "sviluppo";
