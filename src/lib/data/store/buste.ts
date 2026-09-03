/**
 * Le buste delle righe che NON sono giornate (SPEC R6, §6-bis; migration
 * 022): memo, recap, domande aperte, soprannomi, esclusioni. Stessa
 * serratura delle cassettine, una busta per riga nella colonna `busta`;
 * le colonne di testo di prima restano vuote per le righe nuove e piene
 * per quelle scritte prima della cassaforte, che si leggono ancora da li
 * finche non vengono portate dentro (R12).
 *
 * Dove il contenuto faceva da chiave di unicita sul server (alias,
 * soggetto_key, label_key) si scrive l'IMPRONTA: HMAC-SHA256 con la chiave
 * del diario. Deterministica, quindi l'unicita regge; illeggibile senza
 * la chiave.
 */
import { chiavi } from "@/lib/cassaforte";
import { apri, bustaDaTesto, chiudi, impronta, testoDaBusta } from "@/lib/cassaforte/serratura";

/** Chiude un oggetto in una busta (testo per la colonna `busta`). */
export async function chiudiRiga(valore: unknown): Promise<string> {
  return testoDaBusta(await chiudi(chiavi().aes, valore));
}

/**
 * Apre la busta di una riga. `null` se la riga non ha busta (riga in chiaro,
 * scritta prima della cassaforte): chi chiama legge le colonne di prima.
 */
export async function apriRiga<T>(busta: unknown): Promise<T | null> {
  if (typeof busta !== "string" || !busta) return null;
  const b = bustaDaTesto(busta);
  if (!b) return null;
  return apri<T>(chiavi().aes, b);
}

/** L'impronta deterministica di un testo, per le colonne che fanno da chiave. */
export function improntaDi(testo: string): Promise<string> {
  return impronta(chiavi().hmac, testo);
}
