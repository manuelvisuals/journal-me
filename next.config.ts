import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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

export default nextConfig;
