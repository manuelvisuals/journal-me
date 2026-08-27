"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/brand/brand-mark";
import { isReady, onReady } from "@/lib/app-ready";

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
 * It leaves when the first screen says it has its data (`signalReady()`), not on
 * a fixed timer: a warm launch with the day already cached should not be held
 * back by an animation. FAILSAFE_MS only covers the case where a screen errors
 * out before signalling, so the splash can never trap the user.
 */
const FAILSAFE_MS = 4000;
const FADE_MS = 320;

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

    let done: ReturnType<typeof setTimeout> | undefined;
    const dismiss = () => {
      setLeaving(true);
      done = setTimeout(() => setVisible(false), FADE_MS);
    };

    if (isReady()) {
      dismiss();
      return () => {
        if (done) clearTimeout(done);
      };
    }

    const off = onReady(dismiss);
    const failsafe = setTimeout(dismiss, FAILSAFE_MS);

    return () => {
      off();
      clearTimeout(failsafe);
      if (done) clearTimeout(done);
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
        <BrandMark />
        <span className="jm-splash-dot">day</span>alogue
      </div>
      <div className="jm-splash-bar">
        <i />
      </div>
    </div>
  );
}
