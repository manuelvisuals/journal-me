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
 * SEI DECIMALI, NON QUATTRO (12 settembre 2026, Manuel: "quando scrollo
 * tremola in su e giu, pochi pixel, fastidioso").
 *
 * Erano quattro, e per anni sono bastati perche le piste erano corte. Con
 * la pista della scena "come funziona" portata a 660svh il conto si e
 * rotto: su 6574 pixel di corsa, un centesimo di millesimo di --s vale
 * 0,66 pixel di scorrimento, mentre la carta dentro quella scena si sposta
 * di 0,42 pixel per ogni scatto. Un pixel di rotella avanza dunque di UNO
 * o di DUE scatti a seconda di dove cade l'arrotondamento, e la carta si
 * muove alternando 0,42 e 0,84 pixel: non e uno scatto, e un tremolio,
 * ed e esattamente cio che si vede. Misurato scorrendo di un pixel per
 * volta e guardando i delta, non dedotto.
 *
 * A sei decimali lo scatto vale 0,004 pixel, cioe sotto la soglia di
 * qualunque schermo. Regola generale: la precisione di --s deve stare
 * sotto il pixel PER LA PISTA PIU LUNGA del sito, non per quella media.
 * Se un giorno una pista arriva a 2000svh, si rifa questo conto.
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

    /**
     * LA FASCIA DELL'ORA SU IPHONE (11 settembre 2026, richiesta di Manuel:
     * "sarebbe bello se la parte in alto fosse trasparente come nel
     * mockup").
     *
     * Trasparente davvero non si puo, e bene dirlo: dentro Safari quella
     * striscia e cromo del browser e viene sempre dipinta di un colore
     * pieno — `theme-color`, e su Safari 26 il colore del primo elemento
     * fisso, che il CSS tiene uguale. Trasparente lo e solo nell'app
     * installata in schermata Home, dove `black-translucent` +
     * `viewport-fit: cover` (layout.tsx) fanno passare la pagina sotto
     * l'ora: quello e gia acceso.
     *
     * Quello che si puo fare e toglierle il contrasto: finche la pagina e
     * in cima la striscia prende il tono medio dei primi pixel della
     * fotografia velata (#60554b, misurato sul rendering, non scelto a
     * occhio) invece del colore della pagina, che sopra una fotografia si
     * legge come una banda scura. Appena si scende torna il colore della
     * pagina, che li e giusto.
     *
     * Sta prima dell'uscita anticipata perche vale anche per chi ha chiesto
     * meno animazioni: non e un'animazione, e un colore.
     */
    const meta = radice.classList.contains("jm-sito4-archivio-v7")
      ? null
      : document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    // Non si riusa il valore che c'e nel meta: `boot.ts` ci scrive
    // `--jm-bg-app`, che e il fondo CHIARO dell'app (#F7F2E9). Sulla home
    // scura quella striscia color crema e proprio la banda che stiamo
    // togliendo, solo di un altro colore. Il colore giusto da scrollata e
    // il fondo vero della pagina.
    const tonoPagina =
      getComputedStyle(radice).getPropertyValue("--jm-ink").trim() ||
      meta?.content ||
      "";
    /**
     * `data-scorso` sta qui, e non dentro `misura`, per la stessa ragione
     * del colore: non e un'animazione, e uno STATO. E' quello che fa
     * diventare la barra una capsula di vetro quando la pagina scende, e
     * senza di lui il marchio avorio resterebbe nudo sopra le sezioni
     * chiare — cosa che succedeva, fino a oggi, a chiunque avesse chiesto
     * al sistema meno animazioni: l'uscita anticipata qui sotto se lo
     * portava via insieme al parallasse.
     */
    const tingi = () => {
      const giu = window.scrollY > 24;
      radice.toggleAttribute("data-scorso", giu);
      if (meta) meta.content = giu ? tonoPagina : "#60554b";
    };
    tingi();
    window.addEventListener("scroll", tingi, { passive: true });
    const spegniTinta = () => {
      window.removeEventListener("scroll", tingi);
      if (meta) meta.content = tonoPagina;
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return spegniTinta;

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
      for (const el of blocchi) {
        const r = el.getBoundingClientRect();
        let p = (H - r.top) / (H + r.height);
        p = p < 0 ? 0 : p > 1 ? 1 : p;
        el.style.setProperty("--p", p.toFixed(6));
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
        el.style.setProperty("--s", s.toFixed(6));
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
      spegniTinta();
      window.removeEventListener("scroll", chiedi);
      window.removeEventListener("resize", rimisura);
      if (quadro) cancelAnimationFrame(quadro);
    };
  }, []);

  return null;
}
