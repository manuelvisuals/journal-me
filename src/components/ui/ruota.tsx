"use client";

/**
 * La ruota: una colonna di valori che scorre a scatti, come il timer di
 * iPhone. Primitiva di scheletro, nata il 10 settembre 2026 per peso,
 * sonno e mood (mockup MOCKUP-ruote-metriche.html, approvato da Manuel).
 *
 * Com'e fatta, e perche cosi:
 *  - e uno scroll VERO del browser con `scroll-snap`: il dito la lancia,
 *    la frenata e lo scatto li fa iOS, non un'animazione scritta a mano;
 *  - il riquadro e alto cinque righe e ha due righe di aria sopra e
 *    sotto, cosi il primo e l'ultimo valore arrivano al centro;
 *  - la riga selezionata e quella al centro del riquadro: si legge dallo
 *    scrollTop, e ogni cambio esce SUBITO da onChange (il numero grande
 *    sopra la ruota si aggiorna mentre scorri, non a fine corsa);
 *  - niente tastiera: non c'e un input, c'e una lista.
 *
 * L'altezza della riga si MISURA dal DOM e non si suppone: cambia con la
 * dimensione del testo (--jm-ui-scale) e supporla in pixel la romperebbe.
 */

import { useEffect, useLayoutEffect, useRef } from "react";

export type VoceRuota = {
  /** Il valore che torna da onChange. */
  chiave: string;
  /** Cio che si vede. Un ReactNode: la faccia del mood piu la parola. */
  testo: React.ReactNode;
};

type Props = {
  voci: VoceRuota[];
  /** La chiave selezionata. Assente o sconosciuta = la prima. */
  valore: string;
  onChange: (chiave: string) => void;
  /** Classe in piu per la larghezza (jm-ruota-kg, ...). */
  className?: string;
  ariaLabel: string;
};

export function Ruota({ voci, valore, onChange, className = "", ariaLabel }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const ultimaRef = useRef<string>(valore);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const indice = Math.max(0, voci.findIndex((v) => v.chiave === valore));

  /** L'altezza di una riga, misurata. */
  const riga = () => {
    const el = ref.current;
    const primo = el?.firstElementChild as HTMLElement | null;
    return primo?.offsetHeight || 44;
  };

  /* All'apertura la ruota parte gia sul valore, senza animazione: una
     ruota che "arriva" da zero ogni volta e rumore. useLayoutEffect
     perche deve succedere prima del primo disegno. */
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = indice * riga();
    ultimaRef.current = voci[indice]?.chiave ?? valore;
    // Solo all'apertura: se `valore` cambia perche l'utente scorre, lo
    // scroll e gia dove deve stare, e riportarcelo farebbe saltare la ruota.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Mentre scorre: la riga al centro e quella selezionata. */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const suScroll = () => {
      const i = Math.round(el.scrollTop / riga());
      const v = voci[Math.max(0, Math.min(voci.length - 1, i))];
      if (!v || v.chiave === ultimaRef.current) return;
      ultimaRef.current = v.chiave;
      onChangeRef.current(v.chiave);
    };
    el.addEventListener("scroll", suScroll, { passive: true });
    return () => el.removeEventListener("scroll", suScroll);
  }, [voci]);

  return (
    <div
      ref={ref}
      className={`jm-ruota ${className}`}
      role="listbox"
      aria-label={ariaLabel}
      tabIndex={0}
      onKeyDown={(e) => {
        // Da tastiera (desktop, accessibilita): su e giu spostano di uno.
        if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
        e.preventDefault();
        const el = ref.current;
        if (!el) return;
        const i = Math.round(el.scrollTop / riga()) + (e.key === "ArrowDown" ? 1 : -1);
        el.scrollTo({ top: Math.max(0, Math.min(voci.length - 1, i)) * riga(), behavior: "smooth" });
      }}
    >
      {voci.map((v) => (
        <div
          key={v.chiave}
          className={`jm-ruota-v${v.chiave === valore ? " sel" : ""}`}
          role="option"
          aria-selected={v.chiave === valore}
          onClick={() => {
            // Un tocco su una riga vicina la porta al centro.
            const el = ref.current;
            const i = voci.findIndex((x) => x.chiave === v.chiave);
            if (el && i >= 0) el.scrollTo({ top: i * riga(), behavior: "smooth" });
          }}
        >
          {v.testo}
        </div>
      ))}
    </div>
  );
}
