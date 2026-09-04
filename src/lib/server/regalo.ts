/**
 * I limiti del regalo, letti dal server (tabella `regalo`, migration 023).
 *
 * Una riga sola, letta col service role e tenuta in memoria per mezzo
 * minuto: la guardia delle route AI la consulta a ogni chiamata e dieci
 * chiamate di fila non devono fare dieci letture. Quando il pannello admin
 * scrive, chiama dimenticaRegalo() e la chiamata successiva rilegge.
 *
 * Se il database non risponde si torna ai valori di fabbrica: un ospite
 * senza AI per una tabella di configurazione irraggiungibile sarebbe un
 * difetto peggiore di quello che stiamo evitando (stessa regola di aree.ts).
 */

import { REGALO_DI_FABBRICA, regaloDaRiga, type Regalo } from "@/lib/regalo";
import { getAdminClient } from "@/lib/server/entitlement";

const DURATA_CACHE_MS = 30_000;

let cache: { regalo: Regalo; scadenza: number } | null = null;

export async function leggiRegalo(): Promise<Regalo> {
  if (cache && Date.now() < cache.scadenza) return cache.regalo;
  const admin = getAdminClient();
  if (!admin) return REGALO_DI_FABBRICA;
  try {
    const { data, error } = await admin.from("regalo").select("*").eq("id", 1).maybeSingle();
    if (error || !data) return REGALO_DI_FABBRICA;
    const regalo = regaloDaRiga(data as Record<string, unknown>) ?? REGALO_DI_FABBRICA;
    cache = { regalo, scadenza: Date.now() + DURATA_CACHE_MS };
    return regalo;
  } catch {
    return REGALO_DI_FABBRICA;
  }
}

/** Da chiamare quando il pannello admin scrive: la prossima chiamata vede subito. */
export function dimenticaRegalo(): void {
  cache = null;
  spesa = null;
}

/**
 * Quanto ha speso il regalo questo mese, in USD stimati (funzione SQL
 * speso_regalo_mese, una somma sola sull'indice parziale). In memoria per
 * un minuto: il tetto e una soglia mensile, un minuto di ritardo non cambia
 * niente e risparmia una query per chiamata AI. Se non si riesce a leggere
 * si risponde 0: meglio regalare una chiamata in piu che spegnere il regalo
 * per un errore di lettura (la decisione vera la prende il tetto, che si
 * rilegge al minuto dopo).
 */
const DURATA_SPESA_MS = 60_000;
let spesa: { usd: number; scadenza: number } | null = null;

export async function spesoRegaloMeseUsd(): Promise<number> {
  if (spesa && Date.now() < spesa.scadenza) return spesa.usd;
  const admin = getAdminClient();
  if (!admin) return 0;
  try {
    const { data, error } = await admin.rpc("speso_regalo_mese");
    if (error) return 0;
    const usd = typeof data === "number" ? data : Number(data ?? 0);
    const valore = Number.isFinite(usd) ? usd : 0;
    spesa = { usd: valore, scadenza: Date.now() + DURATA_SPESA_MS };
    return valore;
  } catch {
    return 0;
  }
}

/** Il regalo e sopra il tetto del mese? (spesa in USD, tetto in EUR, cambio fisso) */
export function sopraIlTetto(regalo: Regalo, spesoUsd: number): boolean {
  return spesoUsd * regalo.cambioUsdEur >= regalo.tettoMensileEur;
}

/**
 * Registra una spesa appena fatta senza aspettare il minuto della cache:
 * cosi il tetto si chiude anche se cento ospiti chiamano nello stesso
 * minuto (R4: "si chiude da solo").
 */
export function aggiungiSpesaUsd(usd: number): void {
  if (spesa && usd > 0) spesa.usd += usd;
}
