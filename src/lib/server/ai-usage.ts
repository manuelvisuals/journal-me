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
  | "classify"
  | "recap";

/** USD per 1.000.000 di token. */
export const MODEL_PRICES_USD: Record<
  string,
  { input: number; output: number }
> = {
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
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
  userId: string;
  route: AiRoute;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  audioSeconds?: number;
}): Promise<void> {
  try {
    const admin = getAdminClient();
    if (!admin) return;
    await admin.from("ai_usage").insert({
      user_id: entry.userId,
      route: entry.route,
      model: entry.model,
      input_tokens: Math.max(0, Math.round(entry.inputTokens ?? 0)),
      output_tokens: Math.max(0, Math.round(entry.outputTokens ?? 0)),
      audio_seconds: entry.audioSeconds ?? null,
    });
  } catch {
    // Mai far fallire la risposta per un log.
  }
}
