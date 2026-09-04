import { getAdminClient } from "@/lib/server/entitlement";

/**
 * Contatore dei consumi AI (richiesto da Manuel il 19 ago 2026).
 *
 * Ogni route AI, DOPO una risposta OpenAI riuscita, registra qui i token
 * riportati dal campo `usage` della risposta — il conteggio e quindi
 * quello ufficiale di OpenAI, non una stima. La scrittura e best-effort
 * e fire-and-forget: se il log fallisce, la risposta all'utente non ne
 * risente e non si ritenta.
 *
 * I PREZZI vivono qui e sono un'istantanea (agosto 2026, USD per 1M
 * token, listino legacy dei modelli 4o): servono per la STIMA in
 * /api/usage. Se OpenAI cambia listino o si cambiano i modelli, va
 * aggiornata questa tabella.
 */

export type AiRoute =
  | "transcribe"
  | "process-entry"
  | "split-by-date"
  | "extract-people"
  | "extract-facts"
  // Le domande che l'AI fa invece di indovinare (23 agosto 2026).
  | "chiarimenti"
  | "classify"
  | "recap";

/** USD per 1.000.000 di token. */
export const MODEL_PRICES_USD: Record<
  string,
  { input: number; output: number }
> = {
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  // La famiglia corrente. Luna e il modello dell'estrazione dei fatti dal 22
  // agosto 2026 (vedi RISULTATI-prova-modelli.md).
  "gpt-5.6-luna": { input: 0.2, output: 1.2 },
  "gpt-5.6-terra": { input: 2, output: 12 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-5-mini": { input: 0.25, output: 2 },
  "gpt-4o": { input: 2.5, output: 10 },
  // Trascrizione: input = token AUDIO (circa 1 minuto ~ 600 token, ~0,006 $/min).
  "gpt-4o-transcribe": { input: 6, output: 10 },
};

export function estimateUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const p = MODEL_PRICES_USD[model];
  if (!p) return 0;
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}

/** Il campo usage delle Chat Completions. */
export type ChatUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
};

/** Il campo usage delle trascrizioni (due forme possibili). */
export type TranscribeUsage = {
  type?: string;
  input_tokens?: number;
  output_tokens?: number;
  seconds?: number;
};

export async function logAiUsage(entry: {
  /** L'account, se c'e. Un ospite non ne ha: allora c'e il braccialetto. */
  userId: string | null;
  /** Il braccialetto dell'ospite (migration 023), se la chiamata e la sua. */
  braccialettoId?: string | null;
  /** true = la chiamata la paga il regalo: entra nella somma del tetto (R4). */
  regalo?: boolean;
  route: AiRoute;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  audioSeconds?: number;
}): Promise<void> {
  try {
    const admin = getAdminClient();
    if (!admin) return;
    const inputTokens = Math.max(0, Math.round(entry.inputTokens ?? 0));
    const outputTokens = Math.max(0, Math.round(entry.outputTokens ?? 0));
    // La stima in USD si scrive nella riga (colonna costo_usd, 023): cosi la
    // spesa del mese e una somma sola e non un ricalcolo riga per riga.
    const costoUsd = estimateUsd(entry.model, inputTokens, outputTokens);
    // Senza ne account ne braccialetto la riga non passa il check del
    // database (ai_usage_chi_ha_chiamato): non si prova nemmeno.
    if (!entry.userId && !entry.braccialettoId) return;
    await admin.from("ai_usage").insert({
      user_id: entry.userId,
      braccialetto_id: entry.braccialettoId ?? null,
      regalo: entry.regalo === true,
      costo_usd: costoUsd,
      route: entry.route,
      model: entry.model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      audio_seconds: entry.audioSeconds ?? null,
    });
    if (entry.regalo) {
      // Il tetto si aggiorna subito, senza aspettare il minuto della cache.
      const { aggiungiSpesaUsd } = await import("@/lib/server/regalo");
      aggiungiSpesaUsd(costoUsd);
    }
  } catch {
    // Mai far fallire la risposta per un log.
  }
}
