/**
 * I PEZZI di un racconto: tagliarli, prendere l'ultimo, rimetterli insieme.
 *
 * Sta separato da sposta-giorno.ts — che e l'azione, e tira dentro lo store
 * e l'analisi — perche qui non c'e nessun import: e la chirurgia sul testo,
 * cioe il punto dove una frase si puo perdere davvero, e il banco la prova
 * da sola (scripts/verify-sposta-giorno.mjs) senza montare mezza app.
 *
 * Il perche di ogni scelta e in testa a sposta-giorno.ts.
 */

/** Lo stesso separatore che scrive save-recording quando si aggiunge. */
export const SEP_PEZZI = "\n---\n";

/**
 * I pezzi di un racconto. Si taglia sul separatore scritto dall'app; i
 * pezzi vuoti spariscono, perche un separatore in fondo (o due di fila
 * scritti a mano nell'editor) non e un pezzo.
 */
export function pezziDi(transcript: string): string[] {
  return transcript
    .split(SEP_PEZZI)
    .map((p) => p.trim())
    .filter((p) => p !== "");
}

/** L'ultimo pezzo: quello che si sposta. Stringa vuota se non c'e niente. */
export function ultimoPezzo(transcript: string): string {
  const pezzi = pezziDi(transcript);
  return pezzi.length === 0 ? "" : pezzi[pezzi.length - 1];
}

/** Cio che resta al giorno di partenza. Vuoto se il pezzo era l'unico. */
export function senzaUltimoPezzo(transcript: string): string {
  const pezzi = pezziDi(transcript);
  return pezzi.slice(0, -1).join(SEP_PEZZI);
}

/** Il testo del giorno che riceve: quello che c'era, poi il pezzo nuovo. */
export function testoUnito(destinazione: string, pezzo: string): string {
  const gia = destinazione.trim();
  return gia === "" ? pezzo.trim() : gia + SEP_PEZZI + pezzo.trim();
}

