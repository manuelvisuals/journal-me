/**
 * Il codice di recupero: otto parole (SPEC ospite-e-cassaforte §6-bis).
 *
 * Il seme sono 80 bit casuali (10 byte). Ci si attacca un controllo di 8 bit
 * (i primi 8 bit di SHA-256 del seme), e i 88 bit risultanti si leggono a
 * gruppi di 11: otto indici da 0 a 2047, otto parole della lista. E la stessa
 * costruzione di BIP-39, accorciata: 12 parole erano 128 bit di seme scritto
 * per esteso; qui il seme viene stirato da PBKDF2 (serratura.ts) e ne bastano
 * 80 (motivazione nella SPEC).
 *
 * Errori di battitura: ogni parola della lista e unica nelle prime quattro
 * lettere, quindi "cene" e "cenere" sono la stessa cosa; maiuscole e accenti
 * non contano. Una parola che non esiste viene segnalata CON LA POSIZIONE,
 * prima ancora di controllare il checksum: "la settima parola non esiste"
 * invece di "codice sbagliato".
 */
import { PAROLE } from "./parole-lista";
import { byteCasuali } from "./serratura";

export const N_PAROLE = 8;
const BIT_SEME = 80;
const BIT_CONTROLLO = 8;
const BYTE_SEME = BIT_SEME / 8;

const perPrefisso = new Map<string, number>();
const perParola = new Map<string, number>();
PAROLE.forEach((p, i) => {
  perParola.set(p, i);
  perPrefisso.set(p.slice(0, 4), i);
});

export function normalizzaParola(p: string): string {
  return p
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Spezza cio che la persona ha scritto (spazi, virgole, a capo, numeri). */
export function spezzaParole(testo: string): string[] {
  return testo
    .split(/[\s,;.]+/)
    .map((t) => t.replace(/^\d+[.)]?/, ""))
    .map(normalizzaParola)
    .filter(Boolean);
}

async function controlloDi(seme: Uint8Array): Promise<number> {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", seme as BufferSource));
  return h[0];
}

function bitDaByte(b: Uint8Array): string {
  return Array.from(b)
    .map((x) => x.toString(2).padStart(8, "0"))
    .join("");
}

/** Genera un seme nuovo. */
export function semeNuovo(): Uint8Array {
  return byteCasuali(BYTE_SEME);
}

/** Dal seme alle otto parole. */
export async function paroleDaSeme(seme: Uint8Array): Promise<string[]> {
  if (seme.length !== BYTE_SEME) throw new Error("Seme di lunghezza sbagliata");
  const ctrl = await controlloDi(seme);
  const bits = bitDaByte(seme) + ctrl.toString(2).padStart(BIT_CONTROLLO, "0");
  const out: string[] = [];
  for (let i = 0; i < N_PAROLE; i++) {
    out.push(PAROLE[parseInt(bits.slice(i * 11, i * 11 + 11), 2)]);
  }
  return out;
}

export type EsitoParole =
  | { ok: true; seme: Uint8Array; parole: string[] }
  | { ok: false; motivo: "numero"; quante: number }
  | { ok: false; motivo: "sconosciuta"; posizione: number; parola: string }
  | { ok: false; motivo: "controllo" };

/**
 * Dalle parole al seme. Non lancia mai: risponde con un esito che la
 * schermata puo raccontare (quante parole mancano, quale non esiste, oppure
 * il controllo non torna: una parola giusta al posto sbagliato).
 */
export async function semeDaParole(input: string | string[]): Promise<EsitoParole> {
  const parole = Array.isArray(input) ? input.map(normalizzaParola) : spezzaParole(input);
  if (parole.length !== N_PAROLE) {
    return { ok: false, motivo: "numero", quante: parole.length };
  }
  const indici: number[] = [];
  for (let i = 0; i < parole.length; i++) {
    const p = parole[i];
    const idx = indiceDi(p);
    if (idx === undefined) {
      return { ok: false, motivo: "sconosciuta", posizione: i + 1, parola: p };
    }
    indici.push(idx);
  }
  const bits = indici.map((x) => x.toString(2).padStart(11, "0")).join("");
  const seme = new Uint8Array(BYTE_SEME);
  for (let i = 0; i < BYTE_SEME; i++) {
    seme[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  }
  const ctrl = parseInt(bits.slice(BIT_SEME, BIT_SEME + BIT_CONTROLLO), 2);
  if (ctrl !== (await controlloDi(seme))) {
    return { ok: false, motivo: "controllo" };
  }
  return { ok: true, seme, parole: indici.map((i) => PAROLE[i]) };
}

/**
 * L'indice di una parola: esatta, oppure un suo troncamento di almeno quattro
 * lettere ("cene", "cener" -> cenere). "cenerr" NON passa: non e un troncamento,
 * e una lettera in piu, cioe un errore da segnalare.
 */
function indiceDi(p: string): number | undefined {
  const esatto = perParola.get(p);
  if (esatto !== undefined) return esatto;
  if (p.length < 4) return undefined;
  const idx = perPrefisso.get(p.slice(0, 4));
  if (idx === undefined) return undefined;
  return PAROLE[idx].startsWith(p) ? idx : undefined;
}

/** True se la parola (o un suo troncamento di almeno quattro lettere) esiste nella lista. */
export function parolaEsiste(p: string): boolean {
  return indiceDi(normalizzaParola(p)) !== undefined;
}
