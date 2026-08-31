/**
 * L'estratto del racconto che sta in cima a ogni domanda.
 *
 * Regola di Manuel, 31 agosto 2026: una domanda deve SEMPRE far vedere il
 * pezzo di testo da cui nasce. Il motivo e la coda: una domanda su una
 * giornata di tre settimane fa arriva quando non ti ricordi piu cosa avevi
 * detto, e senza la frase davanti non e una domanda, e un indovinello.
 *
 * Fino a oggi la citazione la scriveva il modello, e a volte la lasciava
 * vuota: la domanda compariva nuda. Da qui in avanti, quando manca, la
 * ritaglia il codice. Il codice non inventa: COPIA. Prende dal racconto la
 * frase che contiene la cosa in dubbio e la restituisce com'e — se non la
 * trova ripiega sull'inizio del racconto, che e sempre meglio del vuoto.
 *
 * Vive nel modulo e non in src/lib perche serve in due punti che sono tutti
 * e due suoi: la rotta che genera le domande e la schermata che le mostra.
 */

/** Quanto puo essere lunga una citazione prima di diventare un muro. */
const MAX = 180;

/**
 * Il testo appiattito: minuscolo e senza accenti, ma con la STESSA lunghezza
 * dell'originale.
 *
 * La lunghezza uguale e tutto il punto: si cerca qui e si ritaglia li, quindi
 * un carattere in piu o in meno sposterebbe il taglio. Per questo non si usa
 * `normalize("NFD").replace(...)` sull'intera stringa, che accorcia: si
 * sostituisce una posizione alla volta, e dove la sostituzione non sarebbe
 * lunga uno si tiene il carattere originale.
 */
function pianura(testo: string): string {
  let fuori = "";
  for (let i = 0; i < testo.length; i++) {
    const c = testo[i].toLowerCase();
    const base = c.normalize("NFD")[0] ?? c;
    fuori += base.length === 1 ? base : testo[i].toLowerCase()[0] ?? testo[i];
  }
  return fuori;
}

/** Dove comincia il soggetto dentro il racconto, o -1. */
function dovE(testo: string, soggetto: string): number {
  const ago = soggetto.trim();
  if (!ago) return -1;
  const diretto = pianura(testo).indexOf(pianura(ago));
  if (diretto >= 0) return diretto;
  // Il soggetto non compare tale e quale: succede con le domande di area,
  // dove e una parafrasi ("pomeriggio in piscina"). Si ripiega sulla sua
  // parola piu lunga, che e quasi sempre quella che porta il significato.
  const parole = ago
    .split(/\s+/)
    .map((p) => p.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((p) => p.length >= 4)
    .sort((a, b) => b.length - a.length);
  for (const p of parole) {
    const i = pianura(testo).indexOf(pianura(p));
    if (i >= 0) return i;
  }
  return -1;
}

/** I confini della frase attorno a una posizione. */
function frase(testo: string, i: number): { da: number; a: number } {
  const fine = /[.!?\n]/;
  let da = i;
  while (da > 0 && !fine.test(testo[da - 1])) da--;
  let a = i;
  while (a < testo.length && !fine.test(testo[a])) a++;
  return { da, a };
}

/**
 * La frase del racconto che contiene la cosa in dubbio.
 *
 * Torna stringa vuota solo se il racconto e vuoto: e l'unico caso in cui non
 * c'e niente da mostrare, e allora non si mostra niente invece di inventare.
 */
export function ritagliaCitazione(testo: string, soggetto: string): string {
  const pulito = (testo ?? "").trim();
  if (!pulito) return "";

  const i = dovE(pulito, soggetto);
  if (i < 0) return accorcia(pulito, 0);

  const { da, a } = frase(pulito, i);
  const f = pulito.slice(da, a).trim();
  if (!f) return accorcia(pulito, 0);
  // La frase e lunga: si tiene il pezzo attorno alla cosa in dubbio, non i
  // primi centottanta caratteri, che potrebbero non contenerla.
  return f.length <= MAX ? f : accorcia(pulito, i);
}

/** Un pezzo di MAX caratteri attorno a una posizione, con i puntini. */
function accorcia(testo: string, attorno: number): string {
  if (testo.length <= MAX) return testo;
  let da = Math.max(0, attorno - Math.floor(MAX / 2));
  // Non tagliare a meta di una parola: si arretra fino allo spazio.
  while (da > 0 && !/\s/.test(testo[da - 1])) da--;
  let a = Math.min(testo.length, da + MAX);
  while (a < testo.length && !/\s/.test(testo[a])) a++;
  return (da > 0 ? "... " : "") + testo.slice(da, a).trim() + (a < testo.length ? " ..." : "");
}

/**
 * La citazione spezzata attorno alla cosa in dubbio, per poterla mettere in
 * evidenza: `prima` + `dentro` + `dopo`.
 *
 * Se la cosa non si trova, `dentro` e vuoto e la citazione esce tutta in
 * `prima`: si vede comunque, senza niente in grassetto. Meglio nessun
 * grassetto che il grassetto sulla parola sbagliata.
 */
export function spezzaAttorno(
  citazione: string,
  soggetto: string,
): { prima: string; dentro: string; dopo: string } {
  const ago = (soggetto ?? "").trim();
  if (!citazione || !ago) return { prima: citazione ?? "", dentro: "", dopo: "" };
  const i = pianura(citazione).indexOf(pianura(ago));
  if (i < 0) return { prima: citazione, dentro: "", dopo: "" };
  return {
    prima: citazione.slice(0, i),
    dentro: citazione.slice(i, i + ago.length),
    dopo: citazione.slice(i + ago.length),
  };
}
