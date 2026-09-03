/**
 * La serratura della cassaforte (SPEC ospite-e-cassaforte, R6 e §6-bis).
 *
 * Niente inventato: AES-256-GCM di WebCrypto (`crypto.subtle`), la stessa
 * primitiva di Safari, Chrome e WKWebView. Una chiave per diario, un nonce
 * casuale di 12 byte per OGNI chiusura: due giornate identiche danno due
 * buste diverse, e una busta manomessa non si apre (GCM autentica).
 *
 * La busta e un oggetto JSON piccolo e stabile: `{ v, alg, iv, ct }` con
 * `iv` e `ct` in base64. `v` e la versione del FORMATO della busta (per
 * poter cambiare serratura fra dieci anni), non la versione della giornata:
 * quella sta fuori, in chiaro, ed e il numero che il server controlla (R7).
 *
 * Questo file non sa niente di giornate, tabelle o dispositivi: chiude e
 * apre byte. Chi decide COSA chiudere sta in src/lib/cassaforte/index.ts.
 */

export const BUSTA_V = 1;
export const BUSTA_ALG = "A256GCM";

export type Busta = {
  v: number;
  alg: string;
  iv: string;
  ct: string;
};

/** La frase fissa che, chiusa con la chiave, fa da prova sul server (R8). */
export const FRASE_DI_PROVA = "dayalogue-cassaforte-prova-v1";

function subtle(): SubtleCrypto {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new Error("WebCrypto non disponibile");
  return s;
}

export function base64DaByte(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s);
}

export function byteDaBase64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function byteCasuali(n: number): Uint8Array {
  const b = new Uint8Array(n);
  globalThis.crypto.getRandomValues(b);
  return b;
}

/** Importa 32 byte grezzi come chiave AES-GCM non esportabile. */
export async function importaChiave(grezza: Uint8Array): Promise<CryptoKey> {
  if (grezza.length !== 32) throw new Error("La chiave deve essere di 32 byte");
  return subtle().importKey("raw", grezza as BufferSource, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

/**
 * Dal seme (le parole) alle chiavi: PBKDF2-SHA256, 600.000 giri, sale legato
 * all'utente, 512 bit in uscita divisi in due: la chiave AES della serratura
 * e la chiave HMAC delle impronte. Una derivazione sola (lenta apposta, circa
 * mezzo secondo su un telefono): e cio che rende otto parole sufficienti
 * (SPEC §6-bis).
 */
export const PBKDF2_GIRI = 600_000;

export type Chiavi = { aes: CryptoKey; hmac: CryptoKey };

export async function chiaviDaSeme(seme: Uint8Array, userId: string): Promise<Chiavi> {
  const s = subtle();
  const base = await s.importKey("raw", seme as BufferSource, "PBKDF2", false, ["deriveBits"]);
  const sale = new TextEncoder().encode(`dayalogue-cassaforte-v1:${userId}`);
  const bits = new Uint8Array(
    await s.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt: sale, iterations: PBKDF2_GIRI },
      base,
      512,
    ),
  );
  const aes = await importaChiave(bits.slice(0, 32));
  const hmac = await s.importKey(
    "raw",
    bits.slice(32, 64) as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return { aes, hmac };
}

/** Chiude un valore JSON-serializzabile in una busta. */
export async function chiudi(chiave: CryptoKey, valore: unknown): Promise<Busta> {
  const iv = byteCasuali(12);
  const piano = new TextEncoder().encode(JSON.stringify(valore));
  const ct = await subtle().encrypt({ name: "AES-GCM", iv: iv as BufferSource }, chiave, piano);
  return {
    v: BUSTA_V,
    alg: BUSTA_ALG,
    iv: base64DaByte(iv),
    ct: base64DaByte(new Uint8Array(ct)),
  };
}

export class BustaNonApribile extends Error {
  constructor(msg = "La busta non si apre con questa chiave") {
    super(msg);
    this.name = "BustaNonApribile";
  }
}

/** Apre una busta. Con la chiave sbagliata o una busta manomessa: BustaNonApribile. */
export async function apri<T = unknown>(chiave: CryptoKey, busta: Busta): Promise<T> {
  if (!busta || busta.alg !== BUSTA_ALG || busta.v !== BUSTA_V) {
    throw new BustaNonApribile("Busta di un formato sconosciuto");
  }
  let piano: ArrayBuffer;
  try {
    piano = await subtle().decrypt(
      { name: "AES-GCM", iv: byteDaBase64(busta.iv) as BufferSource },
      chiave,
      byteDaBase64(busta.ct) as BufferSource,
    );
  } catch {
    throw new BustaNonApribile();
  }
  return JSON.parse(new TextDecoder().decode(piano)) as T;
}

export function bustaDaTesto(testo: string): Busta | null {
  try {
    const b = JSON.parse(testo) as Busta;
    return typeof b?.ct === "string" && typeof b?.iv === "string" ? b : null;
  } catch {
    return null;
  }
}

export function testoDaBusta(b: Busta): string {
  return JSON.stringify(b);
}

/**
 * Impronta deterministica di un testo con la chiave del diario (HMAC-SHA256,
 * esadecimale). Serve dove il contenuto faceva da chiave di unicita sul
 * server (alias, soggetto_key, label_key): stesso testo, stessa impronta,
 * quindi l'unicita regge; senza la chiave l'impronta non dice niente.
 */
export async function impronta(chiaveHmac: CryptoKey, testo: string): Promise<string> {
  const sig = await subtle().sign("HMAC", chiaveHmac, new TextEncoder().encode(testo));
  return Array.from(new Uint8Array(sig))
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
