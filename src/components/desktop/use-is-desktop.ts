"use client";

/**
 * Un solo breakpoint, `lg` di Tailwind (SPEC-v2 §5.1). Dove il layout basta,
 * decide il CSS; questo hook serve ai POCHI punti in cui cambia il
 * comportamento (overlay contro editor inline). Niente user-agent sniffing:
 * e la stessa media query dei fogli di stile.
 */

import { useSyncExternalStore } from "react";

const QUERY = "(min-width: 1024px)";

function subscribe(onChange: () => void): () => void {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

export function useIsDesktop(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
