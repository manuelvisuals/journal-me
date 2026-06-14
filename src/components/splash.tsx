"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Controls the server-rendered #jm-splash overlay.
 *
 * The splash markup itself lives in the root layout (server-rendered) so it
 * paints immediately on the initial HTML — before hydration — covering the
 * cold JS load that made the app feel frozen on launch.
 *
 * On mount this:
 *  1. prefetches the main tabs so their FIRST visit is warm (combined with the
 *     router cache, revisits are already instant), and
 *  2. fades out and removes the splash.
 *
 * A tiny inline <script> in the layout is an independent failsafe that removes
 * the splash even if React never hydrates, so it can never block the app.
 */
export function SplashController() {
  const router = useRouter();

  useEffect(() => {
    const routes = ["/", "/mese", "/remember", "/recap", "/settings"];
    for (const r of routes) {
      try {
        router.prefetch(r);
      } catch {
        // best-effort warming
      }
    }

    const el = document.getElementById("jm-splash");
    if (!el) return;
    const fade = setTimeout(() => el.classList.add("jm-splash-hide"), 1100);
    const remove = setTimeout(() => {
      el.remove();
    }, 1550);
    return () => {
      clearTimeout(fade);
      clearTimeout(remove);
    };
  }, [router]);

  return null;
}
