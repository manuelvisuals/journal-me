/**
 * La riga `recensione` letta dal server (migration 030), con cache di
 * mezzo minuto come `regalo.ts`: l'app la chiede una volta al giorno per
 * telefono, ma cento telefoni non devono fare cento letture. Quando il
 * pannello admin scrive, chiama dimenticaRecensione().
 *
 * Se il database non risponde vale la fabbrica, cioe SPENTA: una richiesta
 * di recensione partita per una tabella irraggiungibile sarebbe il
 * contrario di "dormiente".
 */

import { RECENSIONE_DI_FABBRICA, recensioneDaRiga, type Recensione } from "@/lib/recensione-contract";
import { getAdminClient } from "@/lib/server/entitlement";

const DURATA_CACHE_MS = 30_000;

let cache: { recensione: Recensione; scadenza: number } | null = null;

export async function leggiRecensione(): Promise<Recensione> {
  if (cache && Date.now() < cache.scadenza) return cache.recensione;
  const admin = getAdminClient();
  if (!admin) return RECENSIONE_DI_FABBRICA;
  try {
    const { data, error } = await admin.from("recensione").select("attiva, giornate_minime").eq("id", 1).maybeSingle();
    if (error || !data) return RECENSIONE_DI_FABBRICA;
    const recensione = recensioneDaRiga(data as Record<string, unknown>) ?? RECENSIONE_DI_FABBRICA;
    cache = { recensione, scadenza: Date.now() + DURATA_CACHE_MS };
    return recensione;
  } catch {
    return RECENSIONE_DI_FABBRICA;
  }
}

export function dimenticaRecensione(): void {
  cache = null;
}

/** Una riga nel contatore: l'app ha chiesto il foglio ad Apple. */
export async function segnaRichiesta(piattaforma: string): Promise<void> {
  const admin = getAdminClient();
  if (!admin) return;
  try {
    await admin.from("recensione_richieste").insert({ piattaforma });
  } catch {
    // Il contatore non e mai un motivo per far fallire l'app.
  }
}
