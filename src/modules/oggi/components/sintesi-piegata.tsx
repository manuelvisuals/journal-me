"use client";

/**
 * La sintesi piegata: un tetto di sei righe, la sfumatura quando sotto c'e
 * altro, e il tocco che la apre.
 *
 * PERCHE (Manuel, 17 settembre 2026, mockup design/mockups/giornata-altezze-fisse.html).
 * Scorrendo i giorni la riga delle foto ballava di decine di pixel, perche
 * titolo e sintesi sono lunghi quanto capita e nessuno dei due aveva un
 * tetto. Due mosse insieme: il titolo tiene SEMPRE due righe (styles.css,
 * .jm-fv-h) e la sintesi tiene SEMPRE l'altezza del tetto, anche quando e
 * piu corta - scelta esplicita di Manuel, opzione 1 del mockup: un po' di
 * vuoto sotto le sintesi brevi si paga volentieri per avere il tasto
 * "aggiungi" e le foto nello stesso identico punto in ogni giornata.
 *
 * IL TOCCO (opzione 1 delle tre proposte). Finche e piegata, il velo
 * davanti prende il tocco e la APRE: non si corregge un testo che non si
 * vede tutto, e infatti la matita, che sta in fondo alla frase, sotto il
 * tetto non si vedrebbe nemmeno. Da aperta il velo non c'e piu e sotto
 * c'e la sintesi di sempre, che si tocca per riscriverla esattamente come
 * prima di oggi.
 *
 * LA MISURA non passa da uno stato React: si scrive un attributo sul nodo
 * (data-troppo), come fa porta-giorno.tsx per la sua sfumatura. Nessun
 * render in piu, e la sfumatura e una maschera - quindi non deve
 * indovinare il colore di fondo e funziona in tutti i temi, chiari e
 * scuri.
 *
 * LA RETE DI SICUREZZA e in CSS: :focus-within libera l'altezza. Una
 * sintesi corta si puo riscrivere senza aprirla, e il campo di scrittura
 * cresce mentre scrivi - senza quella riga, oltre il tetto finirebbe
 * tagliato.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useT } from "@/lib/i18n";

export function SintesiPiegata({ children }: { children: ReactNode }) {
  const t = useT();
  const [aperta, setAperta] = useState(false);
  const clipRef = useRef<HTMLDivElement | null>(null);
  const dentroRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const clip = clipRef.current;
    const dentro = dentroRef.current;
    if (!clip || !dentro) return;
    if (aperta) {
      clip.removeAttribute("data-troppo");
      return;
    }
    // Il riquadro ha altezza fissa: e il CONTENUTO che cambia, quindi si
    // osserva quello. Un ResizeObserver sul riquadro non scatterebbe mai.
    const guarda = () => {
      clip.toggleAttribute(
        "data-troppo",
        dentro.offsetHeight - clip.clientHeight > 4,
      );
    };
    guarda();
    const ro =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(guarda) : null;
    ro?.observe(dentro);
    window.addEventListener("resize", guarda);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", guarda);
    };
  }, [aperta]);

  return (
    <div className={`jm-fv-piega${aperta ? " aperta" : ""}`}>
      <div className="jm-fv-clip" ref={clipRef}>
        <div ref={dentroRef}>{children}</div>
      </div>
      {!aperta && (
        <button
          type="button"
          className="jm-fv-apri"
          onClick={() => setAperta(true)}
        >
          <span>{t("leggi tutto")}</span>
        </button>
      )}
    </div>
  );
}
