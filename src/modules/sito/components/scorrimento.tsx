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
    /**
     * SI SCRIVE SOLO QUANDO CAMBIA (13 settembre 2026, Manuel: "trema su
     * safari").
     *
     * Prima `meta.content` veniva riscritto a OGNI evento di scorrimento,
     * anche quando il colore era gia quello giusto — cioe centinaia di
     * volte per scrollata, per scrivere sempre lo stesso valore. Su Chrome
     * non si nota. Su Safari `theme-color` non e una proprieta della
     * pagina: e il colore della cornice del browser, che vive in un altro
     * processo, e ogni scrittura e un messaggio a quel processo. Centinaia
     * di messaggi al secondo durante lo scorrimento fanno perdere
     * fotogrammi, e quando si perdono fotogrammi trema tutto quello che si
     * muove, in ogni sezione della pagina.
     *
     * `giu` ricorda l'ultimo stato: dentro una scrollata si scrive due
     * volte in tutto, quando si passa la soglia dei 24 pixel in giu e
     * quando si torna su.
     */
    let giuPrima: boolean | null = null;
    const tingi = () => {
      const giu = window.scrollY > 24;
      if (giu === giuPrima) return;
      giuPrima = giu;
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

    /**
     * LE TRE MISURE DEL TELEFONO DELLA SCENA "come funziona".
     *
     * Il telefono si muoveva cambiando `width`, `left` e `top` a ogni
     * fotogramma. Sono tre proprieta di IMPAGINAZIONE: il browser rifa i
     * conti di posizione e dimensione, e poi ridisegna le due ombre
     * sfocate (26 e 46 pixel di raggio) alla misura nuova. Sessanta volte
     * al secondo, su un elemento alto mezza finestra. Su Safari e la cosa
     * piu cara della scena.
     *
     * Adesso il telefono ha una misura sola e ferma, e si muove con
     * `transform`, che sta sul compositore e non tocca l'impaginazione. Ma
     * `transform` ragiona in unita sue: le percentuali sono dell'elemento,
     * non del riquadro che lo contiene, e `scale` vuole un numero puro,
     * mentre in CSS non si puo dividere una lunghezza per un'altra. Quindi
     * i tre numeri si MISURANO qui, una volta per ridimensionamento:
     *
     *   --tel-k       quanto e piccolo al centro rispetto a quanto e
     *                 grande di lato (dentro / fuori), numero puro
     *   --tel-corsa   il 48% della larghezza della scena, in pixel
     *   --tel-salita  l'8% dell'altezza della scena, in pixel
     *
     * `getComputedStyle().width` e non `getBoundingClientRect()`: il
     * secondo restituisce la misura DOPO il transform, e con una scala
     * addosso darebbe il numero sbagliato.
     */
    const misuraTelefono = () => {
      const tel = radice.querySelector<HTMLElement>(".jm-sito12-telefono");
      const scena = radice.querySelector<HTMLElement>(".jm-sito12-scena");
      if (!tel || !scena) return;
      const fuori = parseFloat(getComputedStyle(tel).width);
      tel.style.width = "var(--dentro)";
      const dentro = parseFloat(getComputedStyle(tel).width);
      tel.style.removeProperty("width");
      if (fuori > 0 && dentro > 0) {
        scena.style.setProperty("--tel-k", (dentro / fuori).toFixed(5));
      }
      const r = scena.getBoundingClientRect();
      scena.style.setProperty("--tel-corsa", `${(r.width * 0.48).toFixed(1)}px`);
      scena.style.setProperty("--tel-salita", `${(r.height * 0.08).toFixed(1)}px`);
    };

    /**
     * PRIMA TUTTE LE MISURE, POI TUTTE LE SCRITTURE (13 settembre 2026,
     * Manuel: "trema su come funziona fino alla fine del lucchetto").
     *
     * Il ciclo di prima faceva, per ognuno dei ventiquattro blocchi:
     * misura -> scrivi -> misura -> scrivi. Sembra ovvio scritto cosi, ed e
     * il difetto piu vecchio del mestiere. Ogni scrittura di una variabile
     * CSS sporca lo stile; la misura subito dopo pretende un valore
     * aggiornato, quindi obbliga il browser a rifare stile e impaginazione
     * SUBITO, prima di restituire il numero. Ventiquattro volte per
     * fotogramma.
     *
     * Chrome non lo paga: sa che una variabile personalizzata non cambia
     * l'impaginazione e non ricalcola niente (misurato qui: 0,097ms contro
     * 0,065ms, cioe niente). Safari quel trucco non ce l'ha: una variabile
     * ereditata che cambia invalida tutto il sottoalbero, e la misura
     * successiva paga il conto intero. E' il motivo per cui il difetto si
     * vede su Safari e su nessun banco.
     *
     * Adesso e in due tempi: si misura tutto, poi si scrive tutto. Zero
     * ricalcoli forzati per fotogramma invece di ventiquattro.
     *
     * E SI SCRIVE SOLO CIO CHE E' CAMBIATO. Dei venti blocchi `data-fx`,
     * in un dato momento se ne muovono uno o due: gli altri hanno `--p`
     * gia inchiodato a 0 o a 1 e riscriverglielo uguale, per Safari, e
     * comunque un'invalidazione di stile. Il confronto con l'ultimo valore
     * scritto porta le scritture per fotogramma da ventiquattro a una o
     * due.
     */
    const ultimo = new Map<HTMLElement, string>();
    const scrivi = (el: HTMLElement, nome: string, valore: string) => {
      const chiave = `${nome}${valore}`;
      if (ultimo.get(el) === chiave) return;
      ultimo.set(el, chiave);
      el.style.setProperty(nome, valore);
    };

    const misura = () => {
      quadro = 0;
      const H = window.innerHeight;
      // --- primo tempo: solo misure, nessuna scrittura ---
      const pBlocchi: number[] = [];
      const topBlocchi: number[] = [];
      for (const el of blocchi) {
        const r = el.getBoundingClientRect();
        let p = (H - r.top) / (H + r.height);
        p = p < 0 ? 0 : p > 1 ? 1 : p;
        pBlocchi.push(p);
        topBlocchi.push(r.top);
      }
      const sPiste: number[] = [];
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
        sPiste.push(s);
      }
      // --- secondo tempo: solo scritture, nessuna misura ---
      for (let i = 0; i < blocchi.length; i++) {
        const el = blocchi[i];
        scrivi(el, "--p", pBlocchi[i].toFixed(6));
        if (!visti.has(el) && topBlocchi[i] < H * 0.86) {
          visti.add(el);
          el.style.setProperty("--v", "1");
        }
      }
      for (let i = 0; i < piste.length; i++) {
        scrivi(piste[i], "--s", sPiste[i].toFixed(6));
      }
    };
    /**
     * UN GIRO PER FOTOGRAMMA FINCHE' LA PAGINA SCORRE, non uno per evento
     * di scorrimento.
     *
     * Su Safari gli eventi di scorrimento non arrivano uno per fotogramma:
     * lo scorrimento vive su un altro thread e gli eventi si accavallano o
     * si saltano. Chiedendo il fotogramma dall'evento, capitava che un
     * fotogramma non ricevesse nessuna misura (la scena resta ferma) e
     * quello dopo ne ricevesse due (la scena fa un salto doppio). Un
     * fermo-doppio-fermo-doppio e esattamente quello che l'occhio chiama
     * tremolio.
     *
     * Adesso il primo evento accende un giro che si rimette in coda da
     * solo a ogni fotogramma, e si spegne dopo dieci fotogrammi con la
     * pagina ferma. Cosi la cadenza e una misura per fotogramma dipinto,
     * sempre, e il ritardo — che su Safari resta — diventa COSTANTE, e un
     * ritardo costante non si vede.
     */
    let fermi = 0;
    let ultimoY = -1;
    const giro = () => {
      quadro = 0;
      const y = window.scrollY;
      if (y === ultimoY) {
        fermi++;
      } else {
        fermi = 0;
        ultimoY = y;
      }
      misura();
      if (fermi < 10) quadro = requestAnimationFrame(giro);
    };
    const chiedi = () => {
      fermi = 0;
      if (!quadro) quadro = requestAnimationFrame(giro);
    };

    // Prima misura, POI la classe che accende gli stati "nascosto": cosi i
    // blocchi gia in vista hanno --v=1 nello stesso frame e non lampeggiano.
    misuraScene();
    misuraTelefono();
    misura();
    radice.setAttribute("data-js", "");
    const rimisura = () => {
      misuraScene();
      misuraTelefono();
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
