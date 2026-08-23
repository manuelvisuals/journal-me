"use client";

/**
 * Il popup di congratulazioni dopo l'attivazione del premium (mockup
 * design/mockups/checkout-finto.html §02, approvato il 21 agosto 2026).
 *
 * QUANDO. Solo se qualcuno lo apre con `openPremiumWelcome()`, cioe solo
 * dal momento in cui il piano e appena cambiato. Non c'e nessun segno
 * nell'indirizzo: una scritta tipo `?premium=1` resterebbe nella cronologia
 * e nei segnalibri, e la festa si rifarebbe a ogni ricaricamento.
 *
 * COSA DICE. Non "grazie per l'acquisto", che e cio che interessa a chi
 * vende: l'elenco di cosa si e appena aperto, che e cio che serve a chi ha
 * comprato. Niente coriandoli e niente punti esclamativi.
 *
 * DOVE VIVE. Nel layout, accanto all'avviso di caricamento, montato una
 * volta sola: cosi vale da qualunque schermata si torni. Lo store sta nel
 * modulo, stesso schema di premium-wall e dell'avviso: chi lo apre non deve
 * passare nessuna prop attraverso mezza app.
 */

import { useEffect, useSyncExternalStore } from "react";
import { useT } from "@/lib/i18n";

let open = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

/** Da chiamare subito PRIMA di tornare nel diario. */
export function openPremiumWelcome(): void {
  open = true;
  emit();
}

function close(): void {
  open = false;
  emit();
}

function useOpen(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    () => open,
    () => false,
  );
}

const FEATURES: string[] = [
  "Racconti a voce, il testo si scrive da solo",
  "Titolo, sintesi e macro-aree di ogni giornata",
  "Recap del mese e letture sui pattern",
];

export function PremiumWelcome() {
  const t = useT();
  const isOpen = useOpen();

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.isComposing) close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="jm-cong-scrim"
      role="dialog"
      aria-modal="true"
      aria-label={t("Sei premium")}
      onClick={close}
    >
      <div className="jm-cong" onClick={(e) => e.stopPropagation()}>
        <div className="jm-cong-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <div className="jm-cong-t">{t("Sei premium")}</div>
        <div className="jm-cong-p">
          {t("Da adesso l'app lavora insieme a te. Ecco cosa e cambiato.")}
        </div>
        <div className="jm-cong-list">
          {FEATURES.map((f) => (
            <div key={f} className="jm-cong-li">
              <i aria-hidden="true" />
              <span>{t(f)}</span>
            </div>
          ))}
        </div>
        <button type="button" className="btn-primary" onClick={close}>
          {t("Provalo adesso")}
        </button>
      </div>
    </div>
  );
}
