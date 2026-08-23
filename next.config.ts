import type { NextConfig } from "next";

/**
 * Two builds out of one codebase.
 *
 * - Default (`next build`): the Vercel deploy. It is what serves the API routes
 *   under /api — the OpenAI key lives there and must never ship inside the app.
 * - `JM_MOBILE=1 next build`: a fully static bundle for the iOS shell. No
 *   server, no middleware, no route handlers; every screen fetches its own data
 *   and the AI endpoints are called across the network at NEXT_PUBLIC_API_BASE.
 *
 * `pageExtensions: ["tsx"]` is how the API routes are kept out of the static
 * build: every route handler is a `.ts` file, every page and layout is `.tsx`,
 * so dropping `.ts` from the list makes the exporter ignore them instead of
 * failing on "route handlers cannot be statically exported".
 */
const MOBILE = process.env.JM_MOBILE === "1";

const mobileConfig: NextConfig = {
  output: "export",
  distDir: ".next-mobile",
  pageExtensions: ["tsx"],
  // Each route exports as <route>/index.html, which is what the shell's local
  // file server can resolve without rewrite rules.
  trailingSlash: true,
  images: { unoptimized: true },
};

const webConfig: NextConfig = {
  // The iOS bundle is a different origin from these routes, so the browser
  // preflights every POST to them. Without this the app would only ever work
  // in a tab. Every call now carries an Authorization bearer token (injected
  // by apiFetch, checked by requirePremium): the wildcard origin can stay
  // because CORS `*` never lets cookies travel, and without a valid token a
  // request from anywhere gets a 401 — the origin is not what protects these
  // routes, the token is.
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          {
            key: "Access-Control-Allow-Headers",
            // X-JM-Glossary was only read by /api/realtime/session,
            // deleted in this PR; the transcription glossary travels as a
            // FormData field, not a header.
            //
            // x-jm-lang non e un dettaglio: apiFetch lo mette su OGNI
            // chiamata dal 20 agosto (PR bilingue), e un header non elencato
            // qui fa fallire il preflight PRIMA che la richiesta parta. Sul
            // web non si vede — app e API sono la stessa origine e il
            // preflight non esiste — dentro il guscio iOS invece muore tutto
            // cio che passa da /api, in silenzio. Chi aggiunge un header al
            // client lo aggiunge anche qui.
            value: "Content-Type, Authorization, x-jm-lang",
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, OPTIONS",
          },
        ],
      },
    ];
  },
  experimental: {
    // Client-side Router Cache. Without this, every tab switch re-runs the
    // server route + Supabase query (~1s measured). Holding the RSC payload
    // for a few minutes makes revisiting a tab instant (served from memory).
    // Trade-off: list data can be up to `dynamic` seconds stale on revisit;
    // mutations call router.refresh() to bust it where it matters.
    staleTimes: {
      dynamic: 180,
      static: 300,
    },
  },
};

export default MOBILE ? mobileConfig : webConfig;
