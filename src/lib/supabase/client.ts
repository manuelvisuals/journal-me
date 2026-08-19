import {
  createClient as createSupabaseClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

/**
 * Browser/native Supabase client.
 *
 * Was `createBrowserClient` from @supabase/ssr, which persists the session in
 * document.cookie so server components could read it. The app no longer renders
 * pages on the server: every screen loads its own data client-side, so the
 * cookie round-trip bought nothing — and inside the iOS shell (Capacitor serves
 * the bundle from a custom scheme) cookies are not a reliable store at all.
 *
 * localStorage inside WKWebView is backed by the app container and survives
 * relaunches, so the session persists exactly like a native app's keychain
 * token would, and the same code path works on the web.
 *
 * Single instance per document: creating several clients means several
 * auth-state listeners and several refresh timers racing on the same token.
 */
let cached: SupabaseClient | null = null;

export function createClient(): SupabaseClient {
  if (cached) return cached;
  // Niente non-null assertion: un build solo-locale non deve richiedere le
  // env di Supabase (SPEC-v2 §1). Chi arriva qui senza env riceve un errore
  // chiaro invece di un'esplosione al primo render.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Supabase non configurato: la modalita cloud non e disponibile in questo build.",
    );
  }
  cached = createSupabaseClient(
    url,
    anonKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Picks up the `?code=` of a magic link automatically; harmless in the
        // native shell, where the login is email + password.
        detectSessionInUrl: true,
        flowType: "pkce",
      },
    },
  );
  return cached;
}

/**
 * Access token for calls to the API routes that still live on Vercel. The
 * native bundle is a different origin from the API, so cookies never travel:
 * anything server-side that needs to know who is calling gets this as a
 * bearer token instead.
 */
export async function getAccessToken(): Promise<string | null> {
  const { data } = await createClient().auth.getSession();
  return data.session?.access_token ?? null;
}
