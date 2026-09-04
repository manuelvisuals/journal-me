import { createPrivateKey, createSign } from "node:crypto";
import { BUNDLE_ID_IOS, PRODOTTI_IOS } from "@/lib/pricing";
import { fetchConTetto } from "@/lib/tetto";

/**
 * Il server parla con Apple (App Store Server API), in un posto solo.
 *
 * PERCHE SI CHIEDE AD APPLE INVECE DI VERIFICARE LA FIRMA IN CASA. Una
 * transazione StoreKit 2 e un JWS firmato con una catena di certificati
 * che risale alla radice di Apple. Verificarla noi vorrebbe dire tenere nel
 * codice il certificato radice di Apple e rifare a mano la catena: una
 * riga sbagliata e un "verificato" che non vale niente. Qui si fa la cosa
 * piu semplice che resta sicura: dall'identificativo della transazione
 * (letto dal JWS SENZA fidarsi) si chiede ad Apple, sul suo server e in
 * TLS, la transazione firmata. Cio che torna da api.storekit.itunes.apple.com
 * e la verita, e da li si leggono prodotto, scadenza, ambiente, revoca.
 *
 * L'autenticazione verso Apple e un JWT firmato con la chiave `.p8` di App
 * Store Connect (APPLE_IAP_PRIVATE_KEY, APPLE_IAP_KEY_ID,
 * APPLE_IAP_ISSUER_ID): vive su Vercel, mai nel codice ne nell'app.
 *
 * Ambiente: si prova Production e, se Apple risponde "transazione non
 * trovata" (4040010), Sandbox. E il giro consigliato da Apple per servire
 * la revisione (che compra in sandbox) e i clienti con lo stesso codice.
 *
 * APPLE_API_BASE_URL serve SOLO ai banchi: punta tutto a un Apple finto.
 */

const PRODUZIONE = "https://api.storekit.itunes.apple.com";
const SANDBOX = "https://api.storekit-sandbox.itunes.apple.com";
const TETTO_MS = 10_000;

export type TransazioneApple = {
  transactionId: string;
  originalTransactionId: string;
  productId: string;
  bundleId: string;
  environment: "Sandbox" | "Production" | string;
  /** ms dall'epoca; assente per un acquisto non rinnovabile. */
  expiresDate?: number;
  purchaseDate?: number;
  revocationDate?: number;
  type?: string;
  offerType?: number;
  /** Il nostro user id, se l'app lo ha passato come appAccountToken. */
  appAccountToken?: string;
};

export function configurata(): boolean {
  return Boolean(
    process.env.APPLE_IAP_PRIVATE_KEY && process.env.APPLE_IAP_KEY_ID && process.env.APPLE_IAP_ISSUER_ID,
  );
}

function b64url(b: Buffer | string): string {
  return Buffer.from(b).toString("base64url");
}

/** Il JWT con cui il server si presenta ad Apple (ES256, vale 20 minuti). */
export function gettoneApple(adesso: number = Date.now()): string {
  const kid = process.env.APPLE_IAP_KEY_ID ?? "";
  const iss = process.env.APPLE_IAP_ISSUER_ID ?? "";
  const pem = (process.env.APPLE_IAP_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
  const iat = Math.floor(adesso / 1000);
  const header = b64url(JSON.stringify({ alg: "ES256", kid, typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({ iss, iat, exp: iat + 20 * 60, aud: "appstoreconnect-v1", bid: BUNDLE_ID_IOS }),
  );
  const firma = createSign("SHA256");
  firma.update(`${header}.${payload}`);
  firma.end();
  // Apple vuole la firma ES256 "grezza" (r|s, 64 byte), non DER: e cio che
  // dsaEncoding "ieee-p1363" produce.
  const raw = firma.sign({ key: createPrivateKey(pem), dsaEncoding: "ieee-p1363" });
  return `${header}.${payload}.${b64url(raw)}`;
}

/** Legge il corpo di un JWS SENZA verificarlo: serve solo a sapere cosa chiedere ad Apple. */
export function corpoNonVerificato<T = Record<string, unknown>>(jws: string): T | null {
  try {
    const parti = jws.split(".");
    if (parti.length !== 3) return null;
    return JSON.parse(Buffer.from(parti[1], "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

async function chiedi(base: string, transactionId: string): Promise<{ status: number; body: Record<string, unknown> | null }> {
  const resp = await fetchConTetto(TETTO_MS)(
    `${base}/inApps/v1/transactions/${encodeURIComponent(transactionId)}`,
    { headers: { Authorization: `Bearer ${gettoneApple()}` }, cache: "no-store" },
  );
  let body: Record<string, unknown> | null = null;
  try {
    body = (await resp.json()) as Record<string, unknown>;
  } catch {
    body = null;
  }
  return { status: resp.status, body };
}

/**
 * La transazione come la racconta Apple. Torna null se Apple non la
 * conosce (ne in produzione ne in sandbox) o se le env mancano.
 */
export async function transazioneDaApple(transactionId: string): Promise<TransazioneApple | null> {
  if (!configurata() && !process.env.APPLE_API_BASE_URL) return null;
  const basi = process.env.APPLE_API_BASE_URL ? [process.env.APPLE_API_BASE_URL] : [PRODUZIONE, SANDBOX];
  for (const base of basi) {
    const { status, body } = await chiedi(base, transactionId);
    if (status === 200 && body && typeof body.signedTransactionInfo === "string") {
      const t = corpoNonVerificato<TransazioneApple>(body.signedTransactionInfo);
      // Questo JWS arriva da Apple in TLS: e la fonte, non serve rifidarsi.
      if (t && t.transactionId && t.originalTransactionId && t.productId) return t;
      return null;
    }
    // 4040010 = TransactionIdNotFoundError: si prova l'altro ambiente.
    if (status === 404) continue;
    if (status === 401) throw new Error("Apple: chiave o issuer non validi (401)");
    throw new Error(`Apple: risposta ${status}`);
  }
  return null;
}

/** I prodotti che il server accetta: solo i nostri. */
export function prodottoNostro(productId: string): boolean {
  return (Object.values(PRODOTTI_IOS) as string[]).includes(productId);
}

/** premium se e nostra, non revocata e non scaduta. */
export function pianoDaTransazione(t: TransazioneApple, adesso: number = Date.now()): "free" | "premium" {
  if (t.bundleId !== BUNDLE_ID_IOS) return "free";
  if (!prodottoNostro(t.productId)) return "free";
  if (t.revocationDate) return "free";
  if (typeof t.expiresDate === "number" && t.expiresDate <= adesso) return "free";
  return "premium";
}
