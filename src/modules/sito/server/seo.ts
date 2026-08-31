/**
 * La lettura dei testi SEO dal server.
 *
 * Stessa meccanica di src/lib/server/aree.ts, e per le stesse ragioni: una
 * fetch REST invece del client Supabase (la tabella e pubblica in lettura,
 * non serve nessuna sessione), una cache brevissima in memoria, e i testi
 * di fabbrica quando qualcosa non risponde.
 *
 * LA CACHE DURA POCO DI PROPOSITO. Chi cambia il titolo nel pannello vuole
 * ricaricare la home e vederlo cambiato: trenta secondi sono il massimo che
 * si puo far aspettare senza che sembri rotto, e bastano comunque a evitare
 * una lettura per ogni visita.
 */

import {
  SEO_DI_FABBRICA,
  seoDaRiga,
  urlSeo,
  type PaginaSito,
  type RigaSeo,
} from "@/modules/sito/seo";

const DURATA_CACHE_MS = 30_000;

let cache: { righe: Record<string, RigaSeo>; scadenza: number } | null = null;

async function leggiTutte(): Promise<Record<string, RigaSeo>> {
  if (cache && Date.now() < cache.scadenza) return cache.righe;

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !key) return SEO_DI_FABBRICA;

  try {
    const resp = await fetch(urlSeo(base), {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!resp.ok) return SEO_DI_FABBRICA;
    const grezze = (await resp.json()) as Record<string, unknown>[];
    const righe: Record<string, RigaSeo> = { ...SEO_DI_FABBRICA };
    for (const g of grezze) {
      const riga = seoDaRiga(g);
      if (riga) righe[riga.pagina] = riga;
    }
    cache = { righe, scadenza: Date.now() + DURATA_CACHE_MS };
    return righe;
  } catch {
    return SEO_DI_FABBRICA;
  }
}

/** I testi di UNA pagina. Non fallisce mai: al peggio torna quelli scritti qui. */
export async function leggiSeo(pagina: PaginaSito): Promise<RigaSeo> {
  const righe = await leggiTutte();
  return righe[pagina] ?? SEO_DI_FABBRICA[pagina];
}

/** Da chiamare quando il pannello scrive: il prossimo caricamento vede subito. */
export function dimenticaSeo(): void {
  cache = null;
}
