/**
 * Il braccialetto dell'ospite (SPEC R2; referto REFERTO-ospite-mappa par. 8
 * e 10): un segreto casuale di 32 byte che il dispositivo genera alla prima
 * apertura e tiene DOVE STA GIA IL SEME DELLA CASSAFORTE (chiave.ts): nel
 * portachiavi iCloud dentro il guscio iOS (plugin Cassaforte.swift, conto
 * "braccialetto"), in IndexedDB `journalme-chiave` sul web.
 *
 * Perche il portachiavi: sopravvive alla disinstallazione dell'app, quindi
 * reinstallare non regala una quota nuova (R2). Sul web IndexedDB muore con
 * i dati del sito: la promessa li e piu debole, ed e accettato (referto).
 * Il portachiavi e sincronizzato via iCloud: iPhone e iPad della stessa
 * persona condividono UN braccialetto (decisione E del mockup, proposta).
 *
 * Il segreto viaggia solo nell'intestazione `x-jm-braccialetto` delle
 * chiamate AI (apiFetch); il server ne conserva l'hash. Non sta mai in
 * localStorage (regola di chiave.ts).
 */
import { cancellaSeme, leggiSeme, scriviSeme } from "@/lib/cassaforte/chiave";

export const CONTO_BRACCIALETTO = "braccialetto";

let inMemoria: string | null | undefined;
let inCorso: Promise<string | null> | null = null;

function base64url(b: Uint8Array): string {
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Il braccialetto di questo dispositivo, se esiste. Non ne crea uno. */
export async function leggiBraccialetto(): Promise<string | null> {
  if (inMemoria !== undefined) return inMemoria;
  if (typeof indexedDB === "undefined") return null;
  if (!inCorso) {
    inCorso = leggiSeme(CONTO_BRACCIALETTO)
      .then((b) => (b ? base64url(b) : null))
      .catch(() => null)
      .then((v) => {
        inMemoria = v;
        inCorso = null;
        return v;
      });
  }
  return inCorso;
}

/** Il braccialetto di questo dispositivo, creandolo se manca. */
export async function assicuraBraccialetto(): Promise<string | null> {
  const gia = await leggiBraccialetto();
  if (gia) return gia;
  try {
    const b = new Uint8Array(32);
    crypto.getRandomValues(b);
    await scriviSeme(CONTO_BRACCIALETTO, b);
    inMemoria = base64url(b);
    return inMemoria;
  } catch {
    return null;
  }
}

/** Solo per i banchi e per "cancella tutto": il dispositivo dimentica il braccialetto. */
export async function dimenticaBraccialetto(): Promise<void> {
  try {
    await cancellaSeme(CONTO_BRACCIALETTO);
  } catch {
    // niente da cancellare
  }
  inMemoria = undefined;
}
