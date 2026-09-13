/**
 * Le regole di un messaggio di assistenza: i tetti, e le due trappole per i
 * robot.
 *
 * STANNO IN UN FILE A PARTE PERCHE LE LEGGONO IN DUE: il modulo nel browser
 * (per non far partire un invio che verrebbe rifiutato) e la rotta, che e
 * l'unica verita. Se vivessero in due posti divergerebbero, e nel modo
 * peggiore: il modulo dice "ok", il server dice "no", e in mezzo c'e una
 * persona che non capisce cosa ha sbagliato.
 *
 * Qui dentro non entra Next, non entra Supabase, non entra il DOM: e codice
 * puro, quindi il banco lo prova senza montare niente
 * (scripts/verify-supporto-trappole.mjs).
 */

export const MAX_IMMAGINI = 3;
/** Caratteri del data URL, non byte: una schermata ridotta ne pesa ~200.000. */
export const MAX_BYTE_IMMAGINE = 400_000;

/**
 * IL CAMPO ESCA. Si chiama come un campo che un robot vuole compilare, e
 * resta vuoto per chiunque usi occhi o lettore di schermo perche e fuori
 * campo E dichiarato invisibile. Il nome non deve contenere "esca",
 * "trappola" o "honeypot": i robot scritti bene saltano cio che si dichiara
 * trappola. Si chiama "azienda" come mille moduli veri.
 */
export const CAMPO_ESCA = "azienda";

/**
 * Il tempo minimo fra "pagina aperta" e "invio". Una persona che legge
 * quattro etichette e scrive due righe non ci mette meno di tre secondi; un
 * robot compila e spedisce in decine di millisecondi. Niente enigmi da
 * risolvere: basta guardare l'orologio, e chi scrive non se ne accorge.
 *
 * TRE secondi, non dieci: la soglia deve stare sotto il tempo del piu veloce
 * degli umani, non sopra quello del piu lento dei robot. Sbagliare di qua
 * costa uno spam ogni tanto; sbagliare di la costa una persona vera che si
 * vede rifiutare il messaggio senza capire perche.
 */
export const MIN_MS_COMPILAZIONE = 3_000;

/** Un modulo aperto da otto ore e una linguetta dimenticata, non un invio. */
export const MAX_MS_COMPILAZIONE = 8 * 60 * 60 * 1000;

export type Verdetto =
  | { ok: true }
  /**
   * muto = si risponde "grazie" pur buttando via il messaggio. Dire a un
   * robot "ti ho riconosciuto" e spiegargli come non farsi riconoscere la
   * prossima volta. Una persona qui non ci finisce mai: ne il campo esca ne
   * i tre secondi possono scattare per chi compila davvero.
   */
  | { ok: false; muto: true; perche: string };

/** Le due trappole, in un posto solo. Non tocca ne rete ne database. */
export function setaccio(dati: {
  esca?: unknown;
  msDaApertura?: unknown;
}): Verdetto {
  const esca = dati.esca;
  if (typeof esca === "string" && esca.trim() !== "") {
    return { ok: false, muto: true, perche: "campo esca compilato" };
  }
  const ms = dati.msDaApertura;
  if (typeof ms !== "number" || !Number.isFinite(ms)) {
    // Un client vecchio (una linguetta aperta ieri) non manda il tempo: non
    // e colpa sua e non si butta via niente. La trappola e per chi il tempo
    // ce l'ha e dice un numero impossibile.
    return { ok: true };
  }
  if (ms < MIN_MS_COMPILAZIONE) {
    return { ok: false, muto: true, perche: `compilato in ${Math.round(ms)} ms` };
  }
  if (ms > MAX_MS_COMPILAZIONE) {
    return { ok: false, muto: true, perche: "modulo troppo vecchio" };
  }
  return { ok: true };
}

/**
 * Del contesto si tiene solo cio che serve a rispondere, per un numero fisso
 * di chiavi: cosi il campo non diventa un imbuto dove il client puo infilare
 * qualunque cosa. Le tre chiavi nuove (da, versione, schermata) arrivano
 * dalla linguetta Feedback dell'app.
 */
export function contestoPulito(grezzo: unknown): Record<string, string> {
  const c = (grezzo ?? {}) as Record<string, unknown>;
  const stringa = (v: unknown, max: number) =>
    typeof v === "string" ? v.slice(0, max) : "";
  return {
    ua: stringa(c.ua, 400),
    schermo: stringa(c.schermo, 40),
    lingua_browser: stringa(c.lingua_browser, 20),
    da: stringa(c.da, 20),
    versione: stringa(c.versione, 40),
    schermata: stringa(c.schermata, 80),
  };
}
