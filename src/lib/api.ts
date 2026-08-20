/**
 * Where the API routes live.
 *
 * On the web the app and its API are the same origin, so this is empty and
 * every call stays relative. Inside the iOS shell the bundle is served from a
 * local scheme while the routes stay on Vercel — NEXT_PUBLIC_API_BASE is baked
 * into the mobile build and every /api call is rewritten to absolute.
 *
 * The OpenAI key never moves: it stays in the Vercel environment, on the far
 * side of these endpoints.
 */
import { getAccessToken } from "@/lib/supabase/client";
import { getLang } from "@/lib/i18n";

const BASE = (process.env.NEXT_PUBLIC_API_BASE ?? "").replace(/\/+$/, "");

export function apiUrl(path: string): string {
  return `${BASE}${path}`;
}

/**
 * Default timeout for the textual AI routes (SPEC-v2 §7.3). Transcription
 * ships a whole recording over a possibly bad connection and passes its own
 * `timeoutMs` instead.
 */
const DEFAULT_TIMEOUT_MS = 15_000;

export type ApiFetchInit = RequestInit & { timeoutMs?: number };

/**
 * The one way the client calls its own /api routes. Every route is gated by
 * requirePremium (src/lib/server/entitlement.ts), so this
 *
 * - injects `Authorization: Bearer <access_token>` from the Supabase session
 *   (localStorage, never cookies — see getAccessToken),
 * - injects `x-jm-lang` con la lingua scelta, perche anche cio che scrive
 *   l'AI (titolo, sintesi, recap) deve uscire nella lingua dell'utente: una
 *   interfaccia inglese che genera un titolo in italiano e mezza tradotta,
 *   cioe rotta, and
 * - aborts through an AbortController after `timeoutMs`, so no call can hang
 *   silently (HANDOVER §8 C-bis).
 *
 * No fetch("/api/...") may exist outside this helper. Callers keep their own
 * error handling: apiFetch returns the Response (or throws on abort/network
 * failure) and does not interpret status codes — con UNA eccezione (SPEC-v2
 * §7.3): un 402 apre il muro premium invece di lasciare un "errore" muto.
 * La Response viene comunque restituita, cosi i chiamanti fanno il loro
 * fallback (es. la giornata si salva lo stesso col testo grezzo).
 */
export async function apiFetch(
  path: string,
  init: ApiFetchInit = {},
): Promise<Response> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, headers, ...rest } = init;

  const merged = new Headers(headers);
  const token = await getAccessToken();
  if (token) merged.set("Authorization", `Bearer ${token}`);
  merged.set("x-jm-lang", getLang());

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch(apiUrl(path), {
      ...rest,
      headers: merged,
      signal: ctrl.signal,
    });
    if (resp.status === 402) {
      // Import dinamico per non trascinare il componente dentro ogni
      // modulo dati; se il muro non e montato non succede niente.
      void import("@/components/premium-wall")
        .then((m) => m.openPremiumWall("aiSummary"))
        .catch(() => undefined);
    }
    return resp;
  } finally {
    clearTimeout(timer);
  }
}
