import { createPrivateKey, createSign, randomUUID } from "node:crypto";
import { fetchConTetto } from "@/lib/tetto";

/**
 * DeviceCheck di Apple, lato server (audit del 10 settembre 2026, decisione
 * 2A di Manuel; developer.apple.com/documentation/devicecheck).
 *
 * IL PROBLEMA. Il regalo di dieci giornate con l'AI e legato a un
 * braccialetto, cioe a un segreto casuale che il dispositivo genera da solo.
 * Il server, fino a oggi, creava una riga per QUALUNQUE segreto ben formato:
 * bastava un ciclo di curl con segreti nuovi per avere dieci giornate di
 * OpenAI a testa, e a pagarle era il tetto mensile. Togliere il regalo dal
 * browser non chiudeva niente: la superficie non era il browser, era la
 * route.
 *
 * LA SOLUZIONE DI APPLE. Ogni dispositivo Apple puo chiedere a iOS un
 * token (DCDevice.generateToken) che solo Apple sa leggere. Il server lo
 * manda ad Apple con la propria firma e Apple risponde con DUE BIT per
 * dispositivo e per team, che restano scritti presso Apple anche dopo la
 * disinstallazione e la cancellazione del telefono. Apple stessa dice a
 * cosa servono: "identify devices that have already taken advantage of a
 * promotional offer". Il bit 0 per noi vuol dire "questo dispositivo il
 * regalo l'ha gia avuto".
 *
 * Quindi: un braccialetto NASCE sul server solo con un token DeviceCheck
 * valido e con il bit 0 spento; nascendo, accende il bit. Sul web il token
 * non esiste e il braccialetto non nasce: la regola "sul web non si regala"
 * e una conseguenza, non una riga di UI. iPhone e iPad della stessa persona
 * condividono il braccialetto via portachiavi iCloud, quindi l'iPad non
 * chiede di nascere: lo trova.
 *
 * Variabili d'ambiente (Vercel):
 *   APPLE_DEVICECHECK_KEY_ID       il Key ID della chiave DeviceCheck
 *                                  (Certificates, Identifiers & Profiles >
 *                                  Keys, servizio DeviceCheck: NON e la
 *                                  chiave In-App Purchase di App Store
 *                                  Connect, che e un'altra)
 *   APPLE_TEAM_ID                  il Team ID (dieci caratteri)
 *   APPLE_DEVICECHECK_PRIVATE_KEY  la .p8, con gli a capo scritti come \n
 *   APPLE_DEVICECHECK_BASE_URL     SOLO per i banchi (l'Apple finto) e per
 *                                  le build di sviluppo
 *                                  (api.development.devicecheck.apple.com)
 *
 * Senza le prime tre, DeviceCheck e SPENTO e il server crea i braccialetti
 * come prima: e lo stato dei banchi e dello sviluppo locale. Il pannello
 * admin e Impostazioni non lo sanno: e `configurato()` a dirlo a chi chiede.
 * Quando Manuel avra caricato la chiave su Vercel, il buco si chiude senza
 * un deploy in piu.
 */

const PRODUZIONE = "https://api.devicecheck.apple.com";
/**
 * Una build firmata da Xcode (il telefono di Manuel in sviluppo) produce
 * token dell'ambiente di SVILUPPO, che la produzione rifiuta con 400. Come
 * fa apple-api.ts con sandbox e produzione: si prova la produzione e, se
 * dice "token non valido", si riprova qui; il bit poi si scrive nello
 * stesso ambiente che ha riconosciuto il token.
 */
const SVILUPPO = "https://api.development.devicecheck.apple.com";
const TETTO_MS = 8_000;

export type AmbienteDeviceCheck = string;

export function configurato(): boolean {
  return Boolean(
    (process.env.APPLE_DEVICECHECK_KEY_ID && process.env.APPLE_TEAM_ID && process.env.APPLE_DEVICECHECK_PRIVATE_KEY) ||
      process.env.APPLE_DEVICECHECK_BASE_URL,
  );
}

function b64url(b: Buffer | string): string {
  return Buffer.from(b).toString("base64url");
}

/** Il JWT con cui il server si presenta a DeviceCheck (ES256, iss = Team ID). */
export function gettoneDeviceCheck(adesso: number = Date.now()): string {
  const kid = process.env.APPLE_DEVICECHECK_KEY_ID ?? "";
  const iss = process.env.APPLE_TEAM_ID ?? "";
  const grezza = (process.env.APPLE_DEVICECHECK_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
  const pem = grezza.includes("-----BEGIN") ? grezza.slice(grezza.indexOf("-----BEGIN")) : grezza;
  const iat = Math.floor(adesso / 1000);
  const header = b64url(JSON.stringify({ alg: "ES256", kid, typ: "JWT" }));
  const payload = b64url(JSON.stringify({ iss, iat }));
  if (!pem) {
    // I banchi puntano un Apple finto che non guarda la firma: un gettone
    // vuoto ma ben formato basta, e non si tenta di firmare con niente.
    return `${header}.${payload}.`;
  }
  const firma = createSign("SHA256");
  firma.update(`${header}.${payload}`);
  firma.end();
  const raw = firma.sign({ key: createPrivateKey(pem), dsaEncoding: "ieee-p1363" });
  return `${header}.${payload}.${b64url(raw)}`;
}

export type EsitoDeviceCheck =
  /** Il token vale e questo dispositivo il regalo NON l'ha ancora avuto. */
  | { esito: "libero"; ambiente: AmbienteDeviceCheck }
  /** Il token vale e il bit 0 e gia acceso: il regalo e gia stato dato. */
  | { esito: "gia_dato"; ambiente: AmbienteDeviceCheck }
  /** Apple non riconosce il token (falso, scaduto, di un'altra app). */
  | { esito: "token_non_valido" }
  /** Apple non risponde o il server non e configurato: non si decide qui. */
  | { esito: "non_disponibile"; motivo: string };

function basi(): string[] {
  return process.env.APPLE_DEVICECHECK_BASE_URL ? [process.env.APPLE_DEVICECHECK_BASE_URL] : [PRODUZIONE, SVILUPPO];
}

async function chiama(base: string, percorso: string, corpo: Record<string, unknown>): Promise<{ status: number; testo: string }> {
  const resp = await fetchConTetto(TETTO_MS)(`${base}/v1/${percorso}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${gettoneDeviceCheck()}`, "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
    cache: "no-store",
  });
  return { status: resp.status, testo: await resp.text() };
}

/**
 * Chiede ad Apple i due bit del dispositivo. Apple risponde 200 con un JSON
 * {bit0, bit1, last_update_time} se i bit sono mai stati scritti, e 200 con
 * il testo "Failed to find bit state" se il dispositivo e nuovo per noi
 * (documentato cosi: non e un errore). 400 "Missing or incorrectly formatted
 * device token" o 401 e un token che non vale.
 */
export async function interrogaDispositivo(deviceToken: string): Promise<EsitoDeviceCheck> {
  if (!configurato()) return { esito: "non_disponibile", motivo: "DeviceCheck non configurato" };
  let ultimo: EsitoDeviceCheck = { esito: "token_non_valido" };
  for (const base of basi()) {
    let r: { status: number; testo: string };
    try {
      r = await chiama(base, "query_two_bits", {
        device_token: deviceToken,
        transaction_id: randomUUID(),
        timestamp: Date.now(),
      });
    } catch (e) {
      return { esito: "non_disponibile", motivo: String((e as Error).message ?? e) };
    }
    if (r.status === 200) {
      try {
        const j = JSON.parse(r.testo) as { bit0?: boolean };
        return j.bit0 === true ? { esito: "gia_dato", ambiente: base } : { esito: "libero", ambiente: base };
      } catch {
        // "Failed to find bit state": mai scritto, quindi libero.
        return { esito: "libero", ambiente: base };
      }
    }
    if (r.status === 400 || r.status === 401) {
      // Non valido QUI: forse e un token dell'altro ambiente, si prova il prossimo.
      ultimo = { esito: "token_non_valido" };
      continue;
    }
    return { esito: "non_disponibile", motivo: `Apple ha risposto ${r.status}` };
  }
  return ultimo;
}

/** Accende il bit 0: "il regalo e stato dato a questo dispositivo". */
export async function segnaRegaloDato(deviceToken: string, ambiente: AmbienteDeviceCheck): Promise<boolean> {
  if (!configurato()) return false;
  try {
    const r = await chiama(ambiente, "update_two_bits", {
      device_token: deviceToken,
      transaction_id: randomUUID(),
      timestamp: Date.now(),
      bit0: true,
      bit1: false,
    });
    return r.status === 200;
  } catch {
    return false;
  }
}
