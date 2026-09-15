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
 *
 * L'EMAIL SI OFFRE QUI, DOPO L'ACQUISTO (Apple 5.1.1(v), bocciatura del 14
 * settembre 2026; decisione di Manuel del 15). Quando il premium e finito
 * sul DISPOSITIVO (comprato da ospite, senza email: `dove` =
 * "dispositivo") il foglio dice la cosa vera, che premium e attivo su
 * questo telefono, e offre l'email per portarlo su tutti i dispositivi con
 * la copia nel cloud. E un'offerta, non un pedaggio: "Non ora" chiude e
 * basta, niente seconda finestra, niente funzione che resta chiusa. La
 * strada resta aperta per sempre in Impostazioni ("Premium su tutti i
 * dispositivi"), e quando la persona entra e adotta_braccialetto (migration
 * 025) a portare il premium sul profilo. Nelle parole di Apple: "You may
 * explain to the user that registering will enable them to access the
 * purchased content from any of their supported devices and provide them a
 * way to register at any time."
 */

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";

/** Dove e finito il premium appena attivato: sul profilo o su questo telefono. */
export type DovePremium = "account" | "dispositivo";

let open: DovePremium | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

/** Da chiamare subito PRIMA di tornare nel diario. */
export function openPremiumWelcome(dove: DovePremium = "account"): void {
  open = dove;
  emit();
}

function close(): void {
  open = null;
  emit();
}

function useOpen(): DovePremium | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    () => open,
    () => null,
  );
}

const FEATURES: string[] = [
  "Racconti a voce, il testo si scrive da solo",
  "Titolo, sintesi e macro-aree di ogni giornata",
  "Recap del mese e letture sui pattern",
];

export function PremiumWelcome() {
  const t = useT();
  const router = useRouter();
  const dove = useOpen();
  const isOpen = dove !== null;
  const sulDispositivo = dove === "dispositivo";

  /** L'offerta accettata: si entra con l'email. Il premium segue da solo. */
  const mettiEmail = () => {
    close();
    router.push("/login");
  };

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
          {sulDispositivo
            ? t("Premium e attivo su questo telefono. Ecco cosa e cambiato.")
            : t("Da adesso l'app lavora insieme a te. Ecco cosa e cambiato.")}
        </div>
        <div className="jm-cong-list">
          {FEATURES.map((f) => (
            <div key={f} className="jm-cong-li">
              <i aria-hidden="true" />
              <span>{t(f)}</span>
            </div>
          ))}
        </div>
        {sulDispositivo ? (
          <>
            <div className="jm-cong-p jm-cong-email">
              {t("Con una email lo porti su tutti i tuoi dispositivi e il diario ha una copia cifrata nel cloud. Puoi farlo anche dopo, da Impostazioni.")}
            </div>
            <button type="button" className="btn-primary" onClick={mettiEmail} data-testid="jm-cong-email">
              {t("Metti la tua email")}
            </button>
            <button type="button" className="btn-ghost" onClick={close} data-testid="jm-cong-non-ora">
              {t("Non ora")}
            </button>
          </>
        ) : (
          <button type="button" className="btn-primary" onClick={close}>
            {t("Provalo adesso")}
          </button>
        )}
      </div>
    </div>
  );
}
