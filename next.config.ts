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
  // in a tab. No credentials travel — the session is a bearer token, never a
  // cookie — so a wildcard origin is the honest setting here.
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization, X-JM-Glossary",
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
