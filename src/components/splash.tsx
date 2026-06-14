"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * App splash / preloader.
 *
 * This is a client component but Next still server-renders its markup into the
 * initial HTML, so it paints immediately — before hydration — covering the cold
 * JS load that made the app feel frozen on launch.
 *
 * IMPORTANT: the splash is part of React's render tree, so we hide and remove it
 * ONLY through React state (never document manipulation). An earlier version
 * called el.remove() / a manual script to drop the node, which corrupted React's
 * fiber and crashed the next render that touched <body> (the recording overlay's
 * body portal) with "insertBefore: node is not a child". State-driven unmount
 * keeps React consistent.
 *
 * On mount it also prefetches the main tabs so their first visit is warm (the
 * router cache already makes revisits instant).
 */
export function Splash() {
  const router = useRouter();
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const routes = ["/", "/mese", "/remember", "/recap", "/settings"];
    for (const r of routes) {
      try {
        router.prefetch(r);
      } catch {
        // best-effort warming
      }
    }
    const fade = setTimeout(() => setLeaving(true), 1100);
    const done = setTimeout(() => setVisible(false), 1500);
    return () => {
      clearTimeout(fade);
      clearTimeout(done);
    };
  }, [router]);

  if (!visible) return null;

  return (
    <div
      className={leaving ? "jm-splash jm-splash-hide" : "jm-splash"}
      aria-hidden="true"
    >
      <div className="jm-splash-halo" />
      <div className="jm-splash-mark">
        Journal<span className="jm-splash-dot">.</span>me
      </div>
      <div className="jm-splash-bar">
        <i />
      </div>
    </div>
  );
}
