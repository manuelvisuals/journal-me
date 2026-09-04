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
import { conSegnale } from "@/lib/tetto";
import { ERRORE_REGALO_FINITO, HEADER_BRACCIALETTO } from "@/lib/regalo";
import { leggiBraccialetto } from "@/lib/ospite/braccialetto";

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
 *   silently (HANDOVER §8 C-bis). Il cronometro parte PRIMA del recupero
 *   del gettone: fino al 3 settembre 2026 partiva dopo, e un `getSession`
 *   appeso (rinnovo del gettone senza rete) non era coperto da nessun tetto
 *   (SPEC ospite-e-cassaforte, R11: il tetto vale sull'intera operazione).
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
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    // Il gettone sta sotto lo stesso cronometro della chiamata: se scade
    // qui, il chiamante riceve lo stesso AbortError che riceverebbe dalla
    // fetch.
    const token = await conSegnale(
      getAccessToken(),
      ctrl.signal,
      "gettone di accesso",
    );
    if (token) merged.set("Authorization", `Bearer ${token}`);
    merged.set("x-jm-lang", getLang());
    // Il braccialetto dell'ospite (SPEC R2), se questo dispositivo ne ha
    // uno: e cosi che il server sa a chi sta regalando. Viaggia anche con
    // il gettone di un account gratis, cosi l'ospite diventato account
    // tiene la quota che aveva. Se non c'e, non si crea qui: nasce al
    // primo avvio come ospite (auth-gate).
    const braccialetto = await conSegnale(leggiBraccialetto(), ctrl.signal, "braccialetto");
    if (braccialetto) merged.set(HEADER_BRACCIALETTO, braccialetto);

    const resp = await fetch(apiUrl(path), {
      ...rest,
      headers: merged,
      signal: ctrl.signal,
    });
    if (resp.status === 402) {
      // Due 402 diversi (SPEC R3): "Premium required" apre il muro premium;
      // "regalo_finito" e l'ospite che ha finito il regalo, e il suo muro e
      // un'altra schermata (mockup ospite-primo-avvio 03, in attesa
      // dell'ok). Finche non esiste si annuncia l'evento e basta: la
      // Response torna comunque al chiamante, che fa il suo fallback (la
      // giornata si salva col testo grezzo, R3).
      void resp
        .clone()
        .json()
        .then((body: { error?: string; motivo?: string; usate?: number; max?: number }) => {
          if (body?.error === ERRORE_REGALO_FINITO) {
            window.dispatchEvent(new CustomEvent("jm:regalo-finito", { detail: body }));
            return;
          }
          // Import dinamico per non trascinare il componente dentro ogni
          // modulo dati; se il muro non e montato non succede niente.
          return import("@/modules/abbonamento/components/premium-wall").then((m) =>
            m.openPremiumWall("aiSummary"),
          );
        })
        .catch(() => undefined);
    }
    return resp;
  } finally {
    clearTimeout(timer);
  }
}
