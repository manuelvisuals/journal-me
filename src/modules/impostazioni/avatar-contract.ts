/**
 * Il contratto della foto profilo: le due funzioni che possono sbagliare in
 * silenzio, senza import.
 *
 * PERCHE UN FILE A PARTE E SENZA IMPORT. Il resto della foto profilo si
 * verifica solo aprendo un browser (il foglio, il trascinamento, il pallino
 * che cambia). Queste due cose no: sono aritmetica e una regola di formato,
 * e sono anche le due che, sbagliate, non danno nessun errore — una foto
 * ritagliata storta sembra una scelta di disegno, e una convalida troppo
 * larga non si vede finche non e tardi. Stando qui, senza dipendere da
 * React o da Next, un banco le puo eseguire in Node e confrontarle con dei
 * numeri attesi (scripts/verify-foto-profilo.mjs).
 */

/** Il lato del quadrato che parte, in pixel. Il pallino piu grande e 56. */
export const LATO_AVATAR = 256;

/** Qualita JPEG: sopra 0.85 il file cresce senza che si veda differenza. */
export const QUALITA_AVATAR = 0.82;

/** Quanto si puo ingrandire, oltre alla misura che riempie il cerchio. */
export const ZOOM_MAX_AVATAR = 3;

/**
 * Lo stesso tetto del vincolo nello schema (migration 016), in caratteri di
 * data URL. ~64 KB di base64, cioe circa 48 KB di immagine: il ritaglio a
 * 256px ne produce ~14 KB, quindi c'e margine, ma non infinito.
 */
export const MAX_AVATAR_LEN = 65536;

/**
 * Solo JPEG e PNG, e solo come data URL. Il controllo vive anche nel server
 * (src/modules/impostazioni/server/avatar.ts) perche il client si puo
 * aggirare: senza, il campo sarebbe un posto dove chiunque abbia un account
 * puo scrivere 64 KB di testo arbitrario che poi l'app mette dentro un src.
 */
const DATA_URL_IMMAGINE = /^data:image\/(jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/;

/** `null` = togliere la foto, ed e valido. */
export function avatarValido(v: unknown): v is string | null {
  if (v === null) return true;
  if (typeof v !== "string") return false;
  if (v.length > MAX_AVATAR_LEN) return false;
  return DATA_URL_IMMAGINE.test(v);
}

export type Ritaglio = {
  /** Angolo e lato del quadrato da prendere, in pixel dell'immagine vera. */
  sx: number;
  sy: number;
  lato: number;
};

/**
 * Da cio che si VEDE a cio che si RITAGLIA.
 *
 * A schermo l'immagine e disegnata alla scala `k` (quella che riempie il
 * cerchio, moltiplicata per lo zoom) e spostata di `off` rispetto al centro
 * del palco. Il palco e un quadrato di lato `lato`, e il ritaglio E il
 * palco: quello che sta dentro parte, quello che sta fuori no.
 *
 * Il conto e uno solo, e questa e la ragione per cui sta qui invece che
 * dentro il componente: se la matematica del disegno e quella del ritaglio
 * divergono, la foto che parte non e quella che l'utente ha inquadrato — e
 * nessuno se ne accorge finche non guarda il risultato.
 */
export function calcolaRitaglio(p: {
  /** Larghezza e altezza vere dell'immagine scelta. */
  larghezza: number;
  altezza: number;
  /** Il lato del palco quadrato, a schermo. */
  lato: number;
  /** La scala effettiva a cui l'immagine e disegnata (scalaBase * zoom). */
  k: number;
  /** Lo spostamento applicato dal trascinamento. */
  off: { x: number; y: number };
}): Ritaglio {
  const { larghezza, altezza, lato, k, off } = p;
  const dw = larghezza * k;
  const dh = altezza * k;
  return {
    sx: (dw / 2 - off.x - lato / 2) / k,
    sy: (dh / 2 - off.y - lato / 2) / k,
    lato: lato / k,
  };
}

/**
 * La scala minima: quella che RIEMPIE il cerchio. Sotto questa resterebbe
 * scoperto un bordo, e un avatar con un angolo vuoto e un difetto, non una
 * scelta.
 */
export function scalaBase(larghezza: number, altezza: number, lato: number): number {
  if (!larghezza || !altezza || !lato) return 1;
  return lato / Math.min(larghezza, altezza);
}

/**
 * Limita lo spostamento perche il quadrato del ritaglio resti sempre dentro
 * l'immagine. Senza, si puo trascinare fuori e il ritaglio prende il vuoto.
 */
export function limitaSpostamento(p: {
  larghezza: number;
  altezza: number;
  lato: number;
  k: number;
  x: number;
  y: number;
}): { x: number; y: number } {
  const { larghezza, altezza, lato, k, x, y } = p;
  if (!larghezza || !altezza || !lato) return { x, y };
  const maxX = Math.max(0, (larghezza * k - lato) / 2);
  const maxY = Math.max(0, (altezza * k - lato) / 2);
  return {
    x: Math.max(-maxX, Math.min(maxX, x)),
    y: Math.max(-maxY, Math.min(maxY, y)),
  };
}
