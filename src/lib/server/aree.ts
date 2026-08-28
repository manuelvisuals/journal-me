/**
 * Le aree, lette dal server: e cio che il modello riceve quando riassume
 * una giornata o quando chiede un chiarimento.
 *
 * Legge la tabella con una fetch REST invece che col client Supabase: le
 * aree sono pubbliche in lettura (policy della migration 015), quindi non
 * serve nessuna sessione, e una chiamata sola evita di trascinare un client
 * intero dentro una rotta che deve solo leggere sei righe.
 *
 * SE IL DATABASE NON RISPONDE, SI USA L'ELENCO COTTO DENTRO. Un'analisi che
 * fallisce perche una tabella di configurazione non risponde sarebbe un
 * difetto peggiore di quello che stiamo risolvendo: il diario deve
 * continuare a funzionare con le sei aree di sempre.
 *
 * La cache in memoria dura un minuto: un'area aggiunta dal pannello compare
 * nell'analisi successiva senza riavviare niente, e nel frattempo dieci
 * chiamate di fila non fanno dieci letture.
 */

import { AREE_DI_FABBRICA, areaDaRiga, urlAree, type Area } from "@/lib/aree";

const DURATA_CACHE_MS = 60_000;

let cache: { aree: Area[]; scadenza: number } | null = null;

export async function leggiAree(): Promise<Area[]> {
  if (cache && Date.now() < cache.scadenza) return cache.aree;

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !key) return AREE_DI_FABBRICA;

  try {
    const resp = await fetch(urlAree(base), {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!resp.ok) return AREE_DI_FABBRICA;
    const righe = (await resp.json()) as Record<string, unknown>[];
    const aree = righe
      .map(areaDaRiga)
      .filter((a): a is Area => a !== null);
    // Zero righe non e una risposta valida: vorrebbe dire un diario senza
    // nessuna casella. Meglio le sei di sempre che nessuna.
    if (aree.length === 0) return AREE_DI_FABBRICA;
    cache = { aree, scadenza: Date.now() + DURATA_CACHE_MS };
    return aree;
  } catch {
    return AREE_DI_FABBRICA;
  }
}

/** Da chiamare quando il pannello admin scrive: la prossima analisi vede subito. */
export function dimenticaAree(): void {
  cache = null;
}
