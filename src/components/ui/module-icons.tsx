"use client";

/**
 * Le icone dei moduli, in un file loro.
 *
 * Stanno separate dal registro (src/lib/modules.ts) per una ragione
 * pratica: quel file lo leggono anche pezzi che non disegnano niente, e un
 * file di logica che contiene JSX si trascina dietro React ovunque venga
 * importato. Stessa divisione gia usata per la scala del testo
 * (ui-scale-contract.ts / ui-scale.ts).
 *
 * Sono tutte disegnate con lo stesso tratto delle icone della barra: un
 * modulo non deve sembrare un ospite.
 */

import type { ModuleId } from "@/lib/modules";

const common = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const MODULE_ICONS: Record<ModuleId, React.ReactNode> = {
  // Il libro del Recap (lo stesso della colonna desktop, rail-left.tsx).
  recap: (
    <svg {...common}>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
      <path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H19v3H6.5" />
    </svg>
  ),
  // Un bilanciere.
  palestra: (
    <svg {...common}>
      <path d="M6 7v10M18 7v10M4 9h4M16 9h4M8 12h8" />
    </svg>
  ),
  // Forchetta e coltello.
  cibo: (
    <svg {...common}>
      <path d="M7 3v8a2 2 0 0 0 2 2v8M7 3v5M10 3v5M17 3c-1.5 2-1.5 5-1.5 7h3V3M17 10v11" />
    </svg>
  ),
  // Una luna.
  sonno: (
    <svg {...common}>
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
    </svg>
  ),
  // Cerchi concentrici: il respiro.
  meditazione: (
    <svg {...common}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 5a7 7 0 0 1 7 7M12 19a7 7 0 0 1-7-7" />
    </svg>
  ),
};
