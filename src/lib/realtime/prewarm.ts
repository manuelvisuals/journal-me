/**
 * Best-effort warm-up of the realtime transcription path.
 *
 * Fires a GET to /api/realtime/session, which warms the Vercel serverless
 * function and primes the server -> OpenAI TLS/DNS connection. By the time the
 * user taps record, the slow cold-start work is already done.
 *
 * Throttled so we don't spam: at most once per WARM_INTERVAL. Never throws,
 * never blocks — purely a latency optimization. Does NOT touch the microphone.
 */
import { apiUrl } from "@/lib/api";

const WARM_INTERVAL_MS = 60_000;
let lastWarmedAt = 0;

export function warmRealtime(): void {
  if (typeof window === "undefined") return;
  const now = Date.now();
  if (now - lastWarmedAt < WARM_INTERVAL_MS) return;
  lastWarmedAt = now;
  try {
    void fetch(apiUrl("/api/realtime/session"), {
      method: "GET",
      cache: "no-store",
      keepalive: true,
    }).catch(() => {});
  } catch {
    // ignore — best-effort
  }
}
