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
const BASE = (process.env.NEXT_PUBLIC_API_BASE ?? "").replace(/\/+$/, "");

export function apiUrl(path: string): string {
  return `${BASE}${path}`;
}
