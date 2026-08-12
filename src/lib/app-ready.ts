/**
 * "First screen is ready" signal.
 *
 * The splash used to disappear on a fixed 1.1s timer, which meant the app was
 * never faster than 1.1 seconds even when its data was already there — pure
 * invented latency, and exactly the thing that made the shell feel like a web
 * page. Now every screen fires `signalReady()` as soon as it has its data and
 * the splash gets out of the way at that moment.
 *
 * Fires at most once per launch: later tab switches must not resurrect it.
 */
const EVENT = "jm:ready";

let alreadyReady = false;

export function signalReady(): void {
  if (alreadyReady || typeof window === "undefined") return;
  alreadyReady = true;
  window.dispatchEvent(new Event(EVENT));
}

export function isReady(): boolean {
  return alreadyReady;
}

export function onReady(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
