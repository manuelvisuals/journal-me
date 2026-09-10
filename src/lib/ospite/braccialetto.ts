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
import { tokenDeviceCheck } from "@/lib/native/devicecheck";
import { HEADER_BRACCIALETTO } from "@/lib/regalo";
import { getLang } from "@/lib/i18n";

export const CONTO_BRACCIALETTO = "braccialetto";

/**
 * LA NASCITA SUL SERVER (decisione 2A, 10 settembre 2026). Avere il segreto
 * in tasca non basta piu: il server conosce solo i braccialetti REGISTRATI
 * da POST /api/ospite/braccialetto, che nel guscio iOS porta il token
 * DeviceCheck (cosi Apple ci dice se questo dispositivo il regalo l'ha gia
 * avuto) e sul web non porta niente (e con DeviceCheck acceso sul server il
 * web resta senza regalo: "sul web non si vende e non si regala").
 *
 * Si tenta UNA volta per apertura, all'avvio (auth-gate chiama
 * assicuraBraccialetto), e di nuovo quando il server risponde `solo_app`
 * (api.ts): la seconda copre l'avvio senza rete. Non passa da apiFetch per
 * non fare un ciclo (apiFetch importa questo file per leggere il segreto).
 *
 * Esiti: "gia" (il server lo conosceva), "nato", "solo_app" (niente token:
 * web), "gia_dato" (Apple: questo dispositivo ha gia avuto il regalo),
 * "rimandato" (rete o Apple muti: si riprova alla prossima apertura).
 */
export type EsitoRegistrazione = "gia" | "nato" | "solo_app" | "gia_dato" | "rimandato";

let registrazione: Promise<EsitoRegistrazione> | null = null;
let ultimaRegistrazione: EsitoRegistrazione | null = null;

function apiBase(): string {
  return (process.env.NEXT_PUBLIC_API_BASE ?? "").replace(/\/+$/, "");
}

export async function registraBraccialetto(): Promise<EsitoRegistrazione> {
  if (registrazione) return registrazione;
  registrazione = (async () => {
    const segreto = await leggiBraccialetto();
    if (!segreto) return "rimandato";
    const token = await tokenDeviceCheck();
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "x-jm-lang": getLang(),
        [HEADER_BRACCIALETTO]: segreto,
      };
      // Il gettone dell'account, se c'e: cosi la riga nasce gia legata alla
      // persona (l'ospite diventato account tiene la sua quota).
      try {
        const { getAccessToken } = await import("@/lib/supabase/client");
        const gettone = await getAccessToken();
        if (gettone) headers.Authorization = `Bearer ${gettone}`;
      } catch {
        // in locale il client Supabase non si costruisce: nessun gettone
      }
      const resp = await fetch(`${apiBase()}/api/ospite/braccialetto`, {
        method: "POST",
        headers,
        body: JSON.stringify({ token }),
      });
      if (resp.ok) {
        const j = (await resp.json()) as { esito?: string };
        if (j.esito === "rimandato") return "rimandato";
        return j.esito === "nato" ? "nato" : "gia";
      }
      if (resp.status === 403) return "solo_app";
      if (resp.status === 409) return "gia_dato";
      return "rimandato";
    } catch {
      return "rimandato";
    }
  })().then((e) => {
    ultimaRegistrazione = e;
    // Un "rimandato" si puo ritentare in questa apertura; gli altri esiti no.
    if (e === "rimandato") registrazione = null;
    return e;
  });
  return registrazione;
}

/** L'ultimo esito della registrazione in questa apertura, se c'e stato. */
export function esitoRegistrazione(): EsitoRegistrazione | null {
  return ultimaRegistrazione;
}

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

/**
 * Il braccialetto di questo dispositivo, creandolo se manca, e REGISTRATO
 * sul server (senza aspettare la risposta: chi chiama e l'avvio, che non
 * deve aspettare la rete).
 */
let creazione: Promise<string | null> | null = null;

export async function assicuraBraccialetto(): Promise<string | null> {
  // UNA creazione per volta. AuthGate chiama questa funzione da due effetti
  // allo stesso avvio: senza questa fila nascevano DUE segreti, il primo
  // veniva registrato sul server e il secondo sovrascriveva il primo nel
  // portachiavi (trovato dal banco verify-ospite il 10 settembre 2026:
  // "registrato: false" con una riga sul server). Prima non si vedeva
  // perche la riga nasceva alla prima chiamata AI, col segreto vincente.
  if (creazione) return creazione;
  creazione = (async () => {
    const gia = await leggiBraccialetto();
    if (gia) {
      void registraBraccialetto();
      return gia;
    }
    try {
      const b = new Uint8Array(32);
      crypto.getRandomValues(b);
      await scriviSeme(CONTO_BRACCIALETTO, b);
      inMemoria = base64url(b);
      void registraBraccialetto();
      return inMemoria;
    } catch {
      return null;
    }
  })().finally(() => {
    creazione = null;
  });
  return creazione;
}

/** Solo per i banchi e per "cancella tutto": il dispositivo dimentica il braccialetto. */
export async function dimenticaBraccialetto(): Promise<void> {
  try {
    await cancellaSeme(CONTO_BRACCIALETTO);
  } catch {
    // niente da cancellare
  }
  inMemoria = undefined;
  registrazione = null;
  ultimaRegistrazione = null;
  creazione = null;
}
