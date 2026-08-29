"use client";

import { useEffect, useRef } from "react";

/**
 * Lo scorrimento col dito fra un giorno e l'altro (mockup
 * navigazione-giorno.html §03, approvato da Manuel il 29 agosto 2026).
 *
 * Non e Tinder: Tinder butta via una carta e non la rivede piu, qui si
 * SFOGLIA e si deve poter tornare. Quindi niente rotazione e niente
 * lancio: la giornata segue il dito uno a uno, e a un quarto di schermo
 * (o con un colpo secco) scatta con la molla di iOS.
 *
 * IL VERSO, e il motivo: trascini verso destra e arriva IERI, che entra
 * da sinistra — la stessa parte dove sta la freccia "<" della testata. Le
 * due strade non si contraddicono mai.
 *
 * Cosa NON intercetta, e perche:
 *   - i primi 20px a sinistra dello schermo: quello e il gesto "indietro"
 *     di iOS e glielo lasciamo;
 *   - un gesto che parte piu verticale che orizzontale: e lo scorrimento
 *     della pagina, e da quel momento non si guarda piu;
 *   - un gesto nato dentro un campo di testo o dentro qualcosa che scorre
 *     in orizzontale (data-jm-no-swipe): li il gesto e suo.
 */

const SOGLIA = 0.25; /* un quarto di schermo */
const VELOCE = 0.45; /* px/ms: il colpo secco vale come il viaggio lungo */
const MOLLA = "transform 260ms cubic-bezier(0.32, 0.72, 0, 1)";
const RESISTENZA = 3; /* al muro il dito pesa un terzo */
const RESISTENZA_MAX = 60;
const ZONA_IOS = 20;

type Props = {
  /** Trascinato verso destra: il giorno prima. */
  onPrima: () => void;
  /** Trascinato verso sinistra: il giorno dopo. */
  onDopo: () => void;
  /** True quando il giorno mostrato e oggi: oltre non si va. */
  muroDopo?: boolean;
  /** Chiamato quando il dito sbatte contro il muro del futuro. */
  onMuro?: () => void;
  children: React.ReactNode;
};

export function DaySwipe({
  onPrima,
  onDopo,
  muroDopo = false,
  onMuro,
  children,
}: Props) {
  const box = useRef<HTMLDivElement | null>(null);
  const piano = useRef<HTMLDivElement | null>(null);
  /* Le richiamate cambiano a ogni disegno della schermata, il gesto no:
     il gesto si attacca una volta sola e legge sempre l'ultima versione
     da qui. Si aggiorna DOPO il disegno, non durante. */
  const azioni = useRef({ onPrima, onDopo, muroDopo, onMuro });
  useEffect(() => {
    azioni.current = { onPrima, onDopo, muroDopo, onMuro };
  });

  useEffect(() => {
    const area = box.current;
    const el = piano.current;
    if (!area || !el) return;

    const menoMoto = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let giu = false;
    let deciso = false;
    let x0 = 0;
    let y0 = 0;
    let dx = 0;
    let t0 = 0;

    const largo = () => area.getBoundingClientRect().width || 1;

    const posa = (px: number, conMolla: boolean) => {
      el.style.transition = conMolla ? MOLLA : "none";
      el.style.transform = px === 0 ? "" : `translateX(${px}px)`;
    };

    /** Il giorno esce da una parte, quello nuovo entra dall'altra. */
    const scatta = (verso: -1 | 1) => {
      const w = largo();
      const fai = verso === -1 ? azioni.current.onPrima : azioni.current.onDopo;
      if (menoMoto) {
        posa(0, false);
        fai();
        return;
      }
      posa(verso === -1 ? w : -w, true);
      window.setTimeout(() => {
        fai();
        /* Il contenuto nuovo parte dal lato opposto e si posa. */
        el.style.transition = "none";
        el.style.transform = `translateX(${verso === -1 ? -w * 0.16 : w * 0.16}px)`;
        el.style.opacity = "0";
        requestAnimationFrame(() => {
          el.style.transition = `${MOLLA}, opacity 200ms ease`;
          el.style.transform = "";
          el.style.opacity = "1";
        });
      }, 260);
    };

    const giuHandler = (e: PointerEvent) => {
      const bersaglio = e.target as HTMLElement | null;
      if (
        bersaglio?.closest(
          "input, textarea, [contenteditable='true'], [data-jm-no-swipe]",
        )
      ) {
        return;
      }
      /* La zona del gesto "indietro" di iOS si misura sullo SCHERMO, non
         sul riquadro: su desktop il riquadro e in mezzo alla pagina. */
      if (e.clientX < ZONA_IOS) return;
      giu = true;
      deciso = false;
      dx = 0;
      x0 = e.clientX;
      y0 = e.clientY;
      t0 = Date.now();
      el.style.transition = "none";
    };

    const muoviHandler = (e: PointerEvent) => {
      if (!giu) return;
      const mx = e.clientX - x0;
      const my = e.clientY - y0;
      if (!deciso) {
        if (Math.abs(mx) < 6 && Math.abs(my) < 6) return;
        if (Math.abs(my) >= Math.abs(mx)) {
          /* E uno scorrimento della pagina: da qui in poi non e roba mia. */
          giu = false;
          return;
        }
        deciso = true;
        area.setPointerCapture?.(e.pointerId);
      }
      dx = mx;
      if (dx < 0 && azioni.current.muroDopo) {
        dx = Math.max(dx / RESISTENZA, -RESISTENZA_MAX);
      }
      posa(dx, false);
    };

    const suHandler = () => {
      if (!giu) return;
      giu = false;
      if (!deciso) return;
      const w = largo();
      const v = Math.abs(dx) / Math.max(Date.now() - t0, 1);
      const passa = Math.abs(dx) > w * SOGLIA || v > VELOCE;
      const verso: -1 | 1 = dx > 0 ? -1 : 1;
      const controIlMuro = verso === 1 && azioni.current.muroDopo;
      if (passa && !controIlMuro) {
        scatta(verso);
      } else {
        posa(0, true);
        if (controIlMuro && Math.abs(dx) > 12) azioni.current.onMuro?.();
      }
      dx = 0;
    };

    area.addEventListener("pointerdown", giuHandler);
    area.addEventListener("pointermove", muoviHandler);
    area.addEventListener("pointerup", suHandler);
    area.addEventListener("pointercancel", suHandler);
    return () => {
      area.removeEventListener("pointerdown", giuHandler);
      area.removeEventListener("pointermove", muoviHandler);
      area.removeEventListener("pointerup", suHandler);
      area.removeEventListener("pointercancel", suHandler);
    };
  }, []);

  return (
    <div ref={box} className="jm-day-sw">
      <div ref={piano} className="jm-day-sw-piano">
        {children}
      </div>
    </div>
  );
}
