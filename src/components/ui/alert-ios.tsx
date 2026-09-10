"use client";

/**
 * L'avviso alla maniera di iOS: un riquadro al centro, un titolo, una
 * riga di spiegazione e i tasti uno sotto l'altro (quello che distrugge in
 * rosso, quello che annulla in grassetto). Vetro sotto, come i fogli di
 * sistema di iOS 26.
 *
 * Nato il 10 settembre 2026 per "scarta la bozza" (Manuel: "un popup iOS
 * 26 che chieda se sei sicuro"), e fatto per essere riusato: ogni conferma
 * pericolosa dell'app puo passare da qui invece di inventarsi due bottoni
 * in riga. Non e un alert() del browser: quelli dentro il guscio sono
 * brutti, non seguono il tema e bloccano il WebView.
 *
 * Colori e font dai token del tema: funziona in chiaro, in scuro e con i
 * cinque temi senza una riga in piu.
 */

import { useEffect } from "react";

type Props = {
  titolo: string;
  testo?: string;
  /** Il tasto che fa la cosa: in rosso se `distruttivo`. */
  conferma: string;
  distruttivo?: boolean;
  annulla: string;
  onConferma: () => void;
  onAnnulla: () => void;
};

export function AlertIos({
  titolo,
  testo,
  conferma,
  distruttivo = false,
  annulla,
  onConferma,
  onAnnulla,
}: Props) {
  // Esc = annulla, come toccare fuori.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.isComposing) onAnnulla();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onAnnulla]);

  return (
    <div className="jm-alert-scrim" onClick={onAnnulla}>
      <div
        className="jm-alert"
        role="alertdialog"
        aria-modal="true"
        aria-label={titolo}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="jm-alert-body">
          <div className="jm-alert-t">{titolo}</div>
          {testo && <div className="jm-alert-p">{testo}</div>}
        </div>
        <div className="jm-alert-btns">
          <button
            type="button"
            className={`jm-alert-btn${distruttivo ? " rosso" : ""}`}
            onClick={onConferma}
          >
            {conferma}
          </button>
          <button type="button" className="jm-alert-btn forte" onClick={onAnnulla}>
            {annulla}
          </button>
        </div>
      </div>
    </div>
  );
}
