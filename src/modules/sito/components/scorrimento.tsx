"use client";

import { useEffect } from "react";

/**
 * Le animazioni di scorrimento della home (8 settembre 2026, richiesta di
 * Manuel: "quelle animazioni parallasse stile App Store").
 *
 * Questa e l'UNICA parte della home che si idrata, e non disegna niente:
 * la pagina resta un componente server con tutto il testo nell'HTML.
 * Il lavoro e misurare, una volta per frame di scorrimento, dove sta ogni
 * blocco marcato `data-fx` e scrivere due numeri come variabili CSS:
 *
 *   --p  0 → 1  quanto il blocco ha attraversato la finestra (0: il bordo
 *               alto tocca il fondo; 1: il bordo basso e uscito in cima)
 *   --v  0 | 1  "visto": scatta quando il blocco entra per l'86% e resta
 *
 * e sulla pista della scena (`data-pista`) il progresso `--s` 0 → 1 mentre
 * la scena sta ferma; sulla radice, `data-scorso` quando la pagina non e
 * piu in cima (la barra diventa di vetro). Il resto — quanto sale, quanto sfuma, il parallasse
 * delle foto — e tutto CSS sotto `.jm-sito7[data-js]` in styles.css.
 *
 * Senza JavaScript non succede niente: `data-js` non arriva e la pagina
 * resta tutta visibile. Con `prefers-reduced-motion` il CSS spegne tutto.
 */
export function Scorrimento() {
  useEffect(() => {
    const radice = document.querySelector<HTMLElement>(".jm-sito7");
    if (!radice) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const blocchi = Array.from(radice.querySelectorAll<HTMLElement>("[data-fx]"));
    const piste = Array.from(radice.querySelectorAll<HTMLElement>("[data-pista]"));
    const visti = new WeakSet<HTMLElement>();
    let quadro = 0;

    const misura = () => {
      quadro = 0;
      const H = window.innerHeight;
      // La barra in cima si fa di vetro solo quando la pagina e scesa.
      radice.toggleAttribute("data-scorso", window.scrollY > 24);
      for (const el of blocchi) {
        const r = el.getBoundingClientRect();
        let p = (H - r.top) / (H + r.height);
        p = p < 0 ? 0 : p > 1 ? 1 : p;
        el.style.setProperty("--p", p.toFixed(4));
        if (!visti.has(el) && r.top < H * 0.86) {
          visti.add(el);
          el.style.setProperty("--v", "1");
        }
      }
      for (const el of piste) {
        const r = el.getBoundingClientRect();
        let s = -r.top / (r.height - H);
        s = s < 0 ? 0 : s > 1 ? 1 : s;
        el.style.setProperty("--s", s.toFixed(4));
      }
    };
    const chiedi = () => {
      if (!quadro) quadro = requestAnimationFrame(misura);
    };

    // Prima misura, POI la classe che accende gli stati "nascosto": cosi i
    // blocchi gia in vista hanno --v=1 nello stesso frame e non lampeggiano.
    misura();
    radice.setAttribute("data-js", "");
    window.addEventListener("scroll", chiedi, { passive: true });
    window.addEventListener("resize", chiedi);
    return () => {
      window.removeEventListener("scroll", chiedi);
      window.removeEventListener("resize", chiedi);
      if (quadro) cancelAnimationFrame(quadro);
    };
  }, []);

  return null;
}
