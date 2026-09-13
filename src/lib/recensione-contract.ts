/**
 * Il contratto della richiesta di recensione (13 settembre 2026): la forma
 * della riga `recensione` (migration 030) e i valori di fabbrica, in un
 * posto solo, come `regalo.ts`. Lo importano il server (lib/server) e il
 * client (lib/recensione.ts): qui niente React e niente Supabase.
 *
 * DORMIENTE DI FABBRICA: `attiva = false`. Il pezzo che chiede il foglio
 * di Apple vive gia nell'app; questa riga e cio che lo sveglia, dal
 * pannello /admin, senza deploy e senza aggiornare l'app.
 */

export type Recensione = {
  attiva: boolean;
  /** Giornate salvate su QUEL telefono prima di chiedere. */
  giornateMinime: number;
};

export const RECENSIONE_DI_FABBRICA: Recensione = { attiva: false, giornateMinime: 5 };

/** Non piu di una richiesta ogni tanti giorni per telefono (Apple ne mostra al massimo tre l'anno). */
export const RECENSIONE_OGNI_GIORNI = 120;

export function recensioneDaRiga(riga: Record<string, unknown> | null | undefined): Recensione | null {
  if (!riga) return null;
  const attiva = riga.attiva;
  const n = Number(riga.giornate_minime);
  if (typeof attiva !== "boolean" || !Number.isFinite(n)) return null;
  return { attiva, giornateMinime: Math.max(0, Math.floor(n)) };
}
