"use client";

import { useEffect } from "react";
import { riaffermaTema, useResolvedMode } from "@/themes/runtime";

/**
 * Montato nel layout: non renderizza niente, ma tiene vivo il listener su
 * matchMedia per tutta la sessione. Con appearance `system` il Mac cambia da
 * solo al tramonto, e l'app deve seguirlo senza un reload (SPEC-temi §5).
 *
 * Dal 1 settembre 2026 fa anche la GUARDIA DEL TEMA. Il boot script veste
 * <html> (data-theme, data-mode, custom property) prima del primo paint, ma
 * quegli attributi non stanno nel JSX: se React ricrea la radice — il
 * fallback dopo un errore di idratazione — li spazza via, e l'app ricade
 * sul tema di fabbrica anche se localStorage dice wine (successo sul
 * telefono di Manuel: tema scelto, schermata dei chiarimenti, app tornata
 * minimal da sola). L'observer guarda gli attributi di <html> e riafferma
 * la scelta SOLO quando diverge: riapplicare cambia gli attributi,
 * l'observer riparte, il confronto trova tutto a posto e si ferma — niente
 * rincorsa.
 */
export function ThemeWatcher() {
  useResolvedMode();

  useEffect(() => {
    // Prima passata subito: se il danno e gia fatto, si ripara ora.
    riaffermaTema();
    const observer = new MutationObserver(() => riaffermaTema());
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "data-mode", "style"],
    });
    return () => observer.disconnect();
  }, []);

  return null;
}
