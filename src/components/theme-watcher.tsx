"use client";

import { useResolvedMode } from "@/themes/runtime";

/**
 * Montato nel layout: non renderizza niente, ma tiene vivo il listener su
 * matchMedia per tutta la sessione. Con appearance `system` il Mac cambia da
 * solo al tramonto, e l'app deve seguirlo senza un reload (SPEC-temi §5).
 */
export function ThemeWatcher() {
  useResolvedMode();
  return null;
}
