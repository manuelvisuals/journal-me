/**
 * Best-effort warm-up of the transcription path.
 *
 * Fires a GET to /api/transcribe-fallback, which is the function that turns a
 * finished recording into words. Waking it early means the wait after "Fine" is
 * the transcription itself and not a Vercel cold start on top of it.
 *
 * It used to warm /api/realtime/session, back when the audio was streamed
 * there; that is a different lambda and warming it no longer helps anything.
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
    void fetch(apiUrl("/api/transcribe-fallback"), {
      method: "GET",
      cache: "no-store",
      keepalive: true,
    }).catch(() => {});
  } catch {
    // ignore — best-effort
  }
}
