"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { registerPlugin } from "@capacitor/core";
import { isNative } from "@/lib/native/platform";
import { useResolvedMode } from "@/themes/runtime";

/**
 * IL VETRO VERO DEL DOCK — la meta web (31 agosto 2026, giro 1).
 *
 * Dentro il guscio iOS 26 la pillola del dock non si sfoca da sola: una
 * lastra di vetro NATIVO (ios/App/App/DockVetro.swift) si appoggia sopra
 * la WebView esattamente dove sta la pillola, e rifrange davvero cio che
 * le passa dietro. Questo file e la meta web dell'accordo:
 *
 *   - misura la pillola e dice alla lastra dove stare (`sincronizza`),
 *     rimisurando a ogni resize e a ogni cambio chiaro/scuro;
 *   - quando qualcosa COPRE il dock (un foglio, la registrazione, un velo
 *     scuro) spegne la lastra: il vetro nativo vive SOPRA la pagina, e
 *     senza questo un foglio aperto se lo troverebbe acceso in faccia;
 *   - risponde con `attivo`: finche e true, tab-bar.tsx mette la classe
 *     `jm-dock-nativo` e il velo finto (blur web) si spegne. Quando la
 *     lastra non c'e — web, iOS vecchio, dock coperto — l'imitazione
 *     torna da sola e il dock e identico a prima di questo file.
 *
 * Il contratto del dock (voci, ordine, microfono, bersagli, bolla) NON
 * passa di qui: resta tutto in tab-bar.tsx. La lastra non intercetta
 * tocchi; qui si parla solo di geometria e di luce.
 */

type Modo = "light" | "dark";

export type VetroDock = {
  disponibile(): Promise<{ vetro: boolean }>;
  sincronizza(opts: {
    x: number;
    y: number;
    larghezza: number;
    altezza: number;
    modo: Modo;
  }): Promise<void>;
  nascondi(): Promise<void>;
};

declare global {
  interface Window {
    /** Seam per il banco (verify-dock-nativo.mjs): un finto guscio iOS.
     *  Presente = si usa lui, anche fuori da Capacitor. */
    __jmVetroFinto?: VetroDock;
  }
}

let registrato: VetroDock | null = null;

function pluginVetro(): VetroDock | null {
  if (typeof window !== "undefined" && window.__jmVetroFinto) {
    return window.__jmVetroFinto;
  }
  if (!isNative()) return null;
  if (!registrato) {
    registrato = registerPlugin<VetroDock>("DockVetro");
  }
  return registrato;
}

/** I tre punti di controllo: dentro il primo tasto, sul microfono, dentro
 *  l'ultimo tasto. Se in uno di questi il primo elemento toccabile NON
 *  appartiene al dock, qualcosa lo sta coprendo. */
function dockCoperto(pillola: HTMLElement): boolean {
  const r = pillola.getBoundingClientRect();
  const y = r.top + r.height / 2;
  const punti: Array<[number, number]> = [
    [r.left + 12, y],
    [r.left + r.width / 2, y],
    [r.right - 12, y],
  ];
  for (const [x, py] of punti) {
    const el = document.elementFromPoint(x, py);
    if (!el || !el.closest(".jm-dock-wrap")) return true;
  }
  return false;
}

/**
 * Da montare nel dock, col ref della pillola. Ritorna true finche la
 * lastra nativa e accesa (= il velo web va spento).
 */
export function useVetroNativo(
  pillola: RefObject<HTMLDivElement | null>,
): boolean {
  const [attivo, setAttivo] = useState(false);
  const modo = useResolvedMode();
  /* Il modo vive anche in un ref: i listener di resize/mutazione sono
     montati una volta e non devono inseguire il valore. (Aggiornato in un
     effetto, non durante il render: regola react-hooks/refs.) */
  const modoRef = useRef<Modo>(modo);
  useEffect(() => {
    modoRef.current = modo;
  }, [modo]);

  useEffect(() => {
    const vetro = pluginVetro();
    if (!vetro) return;

    let vivo = true;
    let pronto = false;
    let acceso = false;
    let inCoda = false;

    const sincronizza = () => {
      const p = pillola.current;
      if (!vivo || !pronto || !p) return;
      if (dockCoperto(p)) {
        if (acceso) {
          acceso = false;
          setAttivo(false);
          void vetro.nascondi();
        }
        return;
      }
      const r = p.getBoundingClientRect();
      if (r.width === 0) return;
      acceso = true;
      setAttivo(true);
      void vetro.sincronizza({
        x: r.left,
        y: r.top,
        larghezza: r.width,
        altezza: r.height,
        modo: modoRef.current,
      });
    };

    /* Le mutazioni arrivano a raffica (React monta un foglio in decine di
       passi): si misura una volta per frame, non una volta per passo. */
    const richiedi = () => {
      if (inCoda || !vivo) return;
      inCoda = true;
      requestAnimationFrame(() => {
        inCoda = false;
        sincronizza();
      });
    };

    /* Le mutazioni DENTRO il dock (la bolla che viaggia scrive left/width
       trenta volte al secondo) non dicono niente su chi lo copre: si
       ignorano, o ogni viaggio diventerebbe una raffica di chiamate al
       ponte nativo per non spostare niente. */
    const oss = new MutationObserver((mutazioni) => {
      const fuoriDalDock = mutazioni.some((m) => {
        const el = m.target instanceof Element ? m.target : m.target.parentElement;
        return !el || !el.closest(".jm-dock-wrap");
      });
      if (fuoriDalDock) richiedi();
    });

    void vetro
      .disponibile()
      .then(({ vetro: c }) => {
        if (!vivo || !c) return;
        pronto = true;
        sincronizza();
        oss.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["class", "style"],
        });
        window.addEventListener("resize", richiedi);
        window.addEventListener("orientationchange", richiedi);
      })
      .catch(() => {
        /* Un guscio senza il plugin (bundle nuovo su binario vecchio):
           il dock tiene l'imitazione web e non se ne accorge nessuno. */
      });

    return () => {
      vivo = false;
      oss.disconnect();
      window.removeEventListener("resize", richiedi);
      window.removeEventListener("orientationchange", richiedi);
      if (pronto) void vetro.nascondi();
      setAttivo(false);
    };
    /* `modo` come dipendenza rimonterebbe tutto a ogni cambio chiaro/scuro;
       basta risincronizzare, ed e il ref a portare il valore nuovo. */
  }, [pillola]);

  /* Cambio chiaro/scuro a lastra accesa: la lastra deve cambiare vetro. */
  useEffect(() => {
    if (!attivo) return;
    const vetro = pluginVetro();
    const p = pillola.current;
    if (!vetro || !p) return;
    const r = p.getBoundingClientRect();
    if (r.width === 0) return;
    void vetro.sincronizza({
      x: r.left,
      y: r.top,
      larghezza: r.width,
      altezza: r.height,
      modo,
    });
  }, [modo, attivo, pillola]);

  return attivo;
}
