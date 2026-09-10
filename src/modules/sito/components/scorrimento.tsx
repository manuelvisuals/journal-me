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
    const scene = Array.from(radice.querySelectorAll<HTMLElement>("[data-misura]"));
    const visti = new WeakSet<HTMLElement>();
    let quadro = 0;

    /**
     * LE MISURE DELLA SCENA "Solo tu hai la chiave" (.jm-sito9).
     *
     * Quella scena ha bisogno di tre numeri veri: quanto e alta la lastra,
     * quanto c'e sopra il testo dentro di lei, e quanto e alta la chiave.
     * Da quei tre ricava di quanto deve salire la chiave e quale riga ha
     * gia attraversato. Scriverli a mano nel CSS non regge: cambiano con la
     * larghezza (il titolo va a capo diversamente), con --jm-ui-scale (che
     * di fabbrica non e 1, e 1,15) e col carattere appena finisce di
     * caricarsi. Bastano sette pixel di scarto e la chiave si scolla dal
     * fronte di cifratura. Quindi si misurano qui, e si rimisurano quando
     * la finestra cambia o i font arrivano.
     */
    const misuraScene = () => {
      for (const el of scene) {
        const lastra = el.querySelector<HTMLElement>("[data-lastra]");
        const corpo = el.querySelector<HTMLElement>("[data-corpo]");
        const chiavi = el.querySelector<HTMLElement>("[data-chiavi]");
        const titolo = el.querySelector<HTMLElement>("[data-titolo]");
        if (!lastra || !corpo || !chiavi || !titolo) continue;
        const hl = lastra.getBoundingClientRect().height;
        const hc = chiavi.getBoundingClientRect().height;
        const ht = titolo.getBoundingClientRect().height;
        const testa = corpo.getBoundingClientRect().top - lastra.getBoundingClientRect().top;
        const stile = getComputedStyle(el);
        const stacco = parseFloat(stile.gap) || 0;
        const staccoChiave = parseFloat(stile.getPropertyValue("--gap")) || 0;
        el.style.setProperty("--lastra-h", `${hl.toFixed(1)}px`);
        el.style.setProperty("--testa", `${testa.toFixed(1)}px`);
        el.style.setProperty("--chiave-h", `${hc.toFixed(1)}px`);
        // L'altezza della scena e la somma dei pezzi veri, chiave a riposo
        // compresa: cosi la scena si centra su cio che si vede davvero e su
        // qualunque schermo non taglia niente e non lascia buchi.
        el.style.setProperty(
          "--scena-h",
          `${(ht + stacco + hl + staccoChiave + hc).toFixed(1)}px`,
        );
      }
    };

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
        // Di norma il cursore parte quando la pista esce dallo schermo in
        // cima. Con `data-pista="avanti"` parte prima, quando la pista e
        // scesa al 55% della finestra: serve alle scene che si incollano al
        // CENTRO dello schermo, dove altrimenti si vedrebbe la scena ferma e
        // immobile per quasi uno schermo intero di scorrimento a vuoto.
        const av = el.dataset.pista === "avanti" ? H * 0.55 : 0;
        let s = (av - r.top) / (r.height - H + av);
        s = s < 0 ? 0 : s > 1 ? 1 : s;
        el.style.setProperty("--s", s.toFixed(4));
      }
    };
    const chiedi = () => {
      if (!quadro) quadro = requestAnimationFrame(misura);
    };

    // Prima misura, POI la classe che accende gli stati "nascosto": cosi i
    // blocchi gia in vista hanno --v=1 nello stesso frame e non lampeggiano.
    misuraScene();
    misura();
    radice.setAttribute("data-js", "");
    const rimisura = () => {
      misuraScene();
      chiedi();
    };
    window.addEventListener("scroll", chiedi, { passive: true });
    window.addEventListener("resize", rimisura);
    // I caratteri cambiano le altezze quando arrivano: si rimisura.
    if (typeof document !== "undefined" && "fonts" in document) {
      void document.fonts.ready.then(rimisura);
    }
    return () => {
      window.removeEventListener("scroll", chiedi);
      window.removeEventListener("resize", rimisura);
      if (quadro) cancelAnimationFrame(quadro);
    };
  }, []);

  return null;
}
