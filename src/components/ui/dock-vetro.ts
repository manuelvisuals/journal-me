"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { registerPlugin } from "@capacitor/core";
import { isNative } from "@/lib/native/platform";
import { useResolvedMode, useThemeId } from "@/themes/runtime";

/**
 * IL VETRO VERO DEL DOCK — la meta web (31 agosto 2026; giro 2 il
 * 1 settembre, dopo la prova sul telefono di Manuel).
 *
 * Dentro il guscio iOS 26 la pillola del dock non si sfoca da sola: una
 * lastra di vetro NATIVO (ios/App/App/DockVetro.swift) si appoggia sopra
 * la WebView esattamente dove sta la pillola, e rifrange davvero cio che
 * le passa dietro.
 *
 * LEZIONE DEL GIRO 1, pagata sul telefono: il vetro sta SOPRA la pagina,
 * quindi rifrange anche le icone del dock, che sulla pagina vivono —
 * uscivano sdoppiate e specchiate, "dietro il vetro" (parole di Manuel).
 * Da qui il giro 2: il web FOTOGRAFA il contenuto del dock (icone,
 * scritte, microfono) in un'immagine trasparente e la manda al nativo,
 * che la posa SOPRA la lastra; la bolla diventa una LENTE di vetro
 * nativa che viaggia sul tasto acceso. I tasti web restano dove sono,
 * invisibili ma toccabili: navigazione, bersagli 44x44 e contratto del
 * dock non si spostano di un millimetro.
 *
 * Quando la lastra non c'e — web, iOS vecchio, dock coperto da un
 * foglio, binario senza plugin — la classe `jm-dock-nativo` cade e il
 * dock ridiventa esattamente quello di sempre, imitazione compresa.
 */

type Modo = "light" | "dark";

type Rettangolo = {
  x: number;
  y: number;
  larghezza: number;
  altezza: number;
};

export type VetroDock = {
  disponibile(): Promise<{ vetro: boolean }>;
  sincronizza(
    opts: Rettangolo & {
      modo: Modo;
      /** Dove posare la lente (il tasto acceso), o null: niente lente. */
      lente?: Rettangolo | null;
      /** Il colore della lente (il token --color-glass-lens del tema,
       *  gia risolto in numeri: il nativo non deve sapere niente di CSS). */
      lenteColore?: { r: number; g: number; b: number; a: number } | null;
      /** La lente viaggia animata? (false con prefers-reduced-motion) */
      animato?: boolean;
      /** PNG trasparente del contenuto del dock, base64 senza prefisso.
       *  Assente = il nativo tiene l'immagine che ha gia. */
      immagine?: string;
      /** devicePixelRatio dell'immagine, per riportarla in punti. */
      scala?: number;
    },
  ): Promise<void>;
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
 *  appartiene al dock, qualcosa lo sta coprendo. (I tasti a opacita zero
 *  restano toccabili, quindi restano visibili a elementFromPoint.) */
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

function rettangolo(el: Element): Rettangolo {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, larghezza: r.width, altezza: r.height };
}

/**
 * Il colore della lente, dal token del tema (`--color-glass-lens`), risolto
 * in numeri passando da un canvas: il browser sa leggere qualunque forma il
 * token prenda (rgba, color-mix, oklab), il ponte nativo no. Un pixel solo.
 */
function coloreLente(pillola: HTMLElement): { r: number; g: number; b: number; a: number } | null {
  try {
    const sonda = document.createElement("span");
    sonda.style.backgroundColor = "var(--color-glass-lens)";
    pillola.appendChild(sonda);
    const risolto = getComputedStyle(sonda).backgroundColor;
    sonda.remove();
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.fillStyle = risolto;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    /* getImageData premoltiplica male l'alfa su colori quasi trasparenti in
       alcuni motori: l'alfa vera si riprende dalla stringa quando c'e. */
    const daStringa = /(?:rgba?|color)\([^)]*[/,]\s*([0-9.]+)\s*\)/.exec(risolto);
    const alfa = daStringa ? Number(daStringa[1]) : a / 255;
    return { r, g, b, a: Number.isFinite(alfa) ? alfa : a / 255 };
  } catch {
    return null;
  }
}

/* Lo spegnimento di un dock che muore aspetta un attimo: cambiando
   schermata il dock RINASCE subito dopo (scheletro, poi schermata vera), e
   se il nativo spegnesse davvero, la lente ripartirebbe da ferma invece di
   viaggiare — e il vetro farebbe un occhiolino a ogni navigazione. Se un
   dock nuovo arriva in tempo, l'appuntamento si cancella; se no (si esce
   dall'app, si va al login) lo spegnimento parte per davvero. */
let spegnimentoInSospeso: number | null = null;

/* Il guscio ha gia detto una volta "il vetro c'e"? Da quel momento ogni
   dock nuovo NASCE gia spogliato (classe jm-dock-nativo dal primo frame),
   invece di dipingere le sue icone e spegnerle qualche decimo di secondo
   dopo. Senza questo, a ogni cambio di schermata il dock appena nato
   restava un attimo visibile SOTTO la lastra e il vetro lo rifrangeva:
   fantasmi sdoppiati delle scritte, e la macchia bianca del microfono
   (screenshot di Manuel del 1 settembre). */
let vetroConfermato = false;

/* ============================================================
   LA FOTOGRAFIA DEL DOCK. Icone, scritte e microfono, ridisegnati su un
   canvas trasparente alle stesse coordinate che hanno nella pillola, coi
   colori CALCOLATI (quindi giusti per tema e chiaro/scuro, senza sapere
   niente dei temi). E cio che il nativo posa sopra il vetro.
   ============================================================ */

function svgInImmagine(svg: SVGElement, colore: string): Promise<HTMLImageElement> {
  const clone = svg.cloneNode(true) as SVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  /* `currentColor` dentro un blob non eredita niente: il colore calcolato
     va inchiodato sulla radice. */
  clone.setAttribute("color", colore);
  const xml = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml" }));
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("icona non rasterizzabile"));
    };
    img.src = url;
  });
}

async function fotografaDock(
  pillola: HTMLElement,
): Promise<{ png: string; scala: number } | null> {
  const rp = pillola.getBoundingClientRect();
  if (rp.width === 0) return null;
  /* I font del tema devono esserci, o la prima foto esce col font di
     sistema e la seconda no: uno sfarfallio da un'app diversa. */
  await document.fonts.ready;
  const scala = Math.min(window.devicePixelRatio || 1, 3);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(rp.width * scala));
  canvas.height = Math.max(1, Math.round(rp.height * scala));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(scala, scala);

  const dentro = (el: Element): Rettangolo => {
    const r = el.getBoundingClientRect();
    return {
      x: r.left - rp.left,
      y: r.top - rp.top,
      larghezza: r.width,
      altezza: r.height,
    };
  };

  /* I tasti: icona sopra, parola sotto, ognuno alle SUE coordinate. */
  for (const tasto of pillola.querySelectorAll<HTMLElement>(".jm-dock-t")) {
    const stile = getComputedStyle(tasto);
    const icona = tasto.querySelector<SVGElement>(".jm-dock-i svg");
    if (icona) {
      const ri = dentro(icona);
      try {
        const img = await svgInImmagine(icona, stile.color);
        ctx.drawImage(img, ri.x, ri.y, ri.larghezza, ri.altezza);
      } catch {
        /* Un'icona in meno e meglio di niente foto. */
      }
    }
    const parola = tasto.querySelector<HTMLElement>(".jm-dock-l");
    if (parola) {
      const rl = dentro(parola);
      const sp = getComputedStyle(parola);
      ctx.font = `${sp.fontWeight} ${sp.fontSize} ${sp.fontFamily}`;
      ctx.fillStyle = sp.color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if ("letterSpacing" in ctx) {
        (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing =
          sp.letterSpacing === "normal" ? "0px" : sp.letterSpacing;
      }
      ctx.fillText(
        (parola.textContent ?? "").toUpperCase(),
        rl.x + rl.larghezza / 2,
        rl.y + rl.altezza / 2 + 0.5,
      );
    }
  }

  /* Il microfono: cerchio pieno d'accento, icona sopra. Un elemento a
     misura zero (uno scheletro a meta montaggio) non si disegna: un arco
     di raggio negativo e un'eccezione, e un'eccezione qui ammazzava
     l'intero giro di sincronizzazione (successo al primo banco). */
  const mic = pillola.querySelector<HTMLElement>(".jm-dock-mic");
  if (mic && mic.getBoundingClientRect().width > 2) {
    const rm = dentro(mic);
    const sm = getComputedStyle(mic);
    const cx = rm.x + rm.larghezza / 2;
    const cy = rm.y + rm.altezza / 2;
    const raggio = Math.min(rm.larghezza, rm.altezza) / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, raggio - 0.5, 0, Math.PI * 2);
    ctx.fillStyle = sm.backgroundColor;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = sm.borderTopColor;
    ctx.stroke();
    const iconaMic = mic.querySelector<SVGElement>("svg");
    if (iconaMic) {
      const ri = dentro(iconaMic);
      try {
        const img = await svgInImmagine(iconaMic, sm.color);
        ctx.drawImage(img, ri.x, ri.y, ri.larghezza, ri.altezza);
      } catch {
        /* come sopra */
      }
    }
  }

  const dataUrl = canvas.toDataURL("image/png");
  return { png: dataUrl.slice("data:image/png;base64,".length), scala };
}

/**
 * Da montare nel dock, col ref della pillola. `firma` e cio che, cambiando,
 * impone una nuova fotografia: il tasto acceso e il numero di voci
 * (`${active}:${n}` da tab-bar.tsx); tema e chiaro/scuro li vede da solo.
 * Ritorna true finche la lastra nativa e accesa (= il velo web va spento).
 */
export function useVetroNativo(
  pillola: RefObject<HTMLDivElement | null>,
  firma: string,
): boolean {
  /* NATO GIA SPOGLIATO: se il guscio ha gia confermato il vetro, lo stato
     parte da true e le icone web non vengono mai dipinte sotto la lastra
     (i fantasmi rifratti a ogni cambio di schermata, screenshot di Manuel
     del 1 settembre). Solo il PRIMO dock della vita dell'app parte da
     false — ed e l'unico che viene idratato dal server, quindi il DOM
     combacia sempre. Se poi il giro scopre che il dock e coperto, la
     classe cade e l'imitazione torna. */
  const [attivo, setAttivo] = useState<boolean>(
    () => vetroConfermato && pluginVetro() !== null,
  );
  const modo = useResolvedMode();
  const tema = useThemeId();
  /* Stato vivo per i listener montati una volta (aggiornato in un
     effetto, non durante il render: regola react-hooks/refs). */
  const statoRef = useRef({ modo, tema, firma });
  useEffect(() => {
    statoRef.current = { modo, tema, firma };
  }, [modo, tema, firma]);
  /* La leva per chiedere un giro dal secondo effetto: la posa il primo. */
  const richiediRef = useRef<() => void>(() => {});

  useEffect(() => {
    const vetro = pluginVetro();
    if (!vetro) return;

    let vivo = true;
    let pronto = false;
    let acceso = false;
    let inCoda = false;
    /* La foto si rifa solo quando la sua chiave cambia; per il resto si
       rimanda solo la geometria, che costa niente. */
    let chiaveFoto = "";
    /* Le sincronizzazioni sono async (la foto): un contatore scarta
       quelle rimaste indietro. */
    let giro = 0;

    const sincronizza = async () => {
      const p = pillola.current;
      if (!vivo || !pronto || !p) return;
      if (dockCoperto(p)) {
        /* setAttivo fuori dal ramo `acceso`: un dock nato spogliato
           (ottimismo del layout effect) che scopre di essere coperto deve
           rivestirsi anche se non ha mai acceso la lastra lui. */
        setAttivo(false);
        if (acceso) {
          acceso = false;
          void vetro.nascondi();
        }
        return;
      }
      const r = p.getBoundingClientRect();
      if (r.width === 0) return;
      const questo = ++giro;
      const { modo: m, tema: t, firma: f } = statoRef.current;
      const chiave = `${f}|${t}|${m}|${Math.round(r.width)}x${Math.round(r.height)}`;
      let foto: { png: string; scala: number } | null = null;
      if (chiave !== chiaveFoto) {
        /* Una foto fallita non deve fermare la geometria: lastra e lente
           si aggiornano comunque, e la foto si ritenta al giro dopo. */
        try {
          foto = await fotografaDock(p);
        } catch {
          foto = null;
        }
        if (!vivo || questo !== giro) return;
        if (foto) chiaveFoto = chiave;
      }
      const tastoAcceso = p.querySelector(".jm-dock-t.on");
      const riduci =
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
      acceso = true;
      setAttivo(true);
      void vetro.sincronizza({
        ...rettangolo(p),
        modo: m,
        lente: tastoAcceso ? rettangolo(tastoAcceso) : null,
        lenteColore: coloreLente(p),
        animato: !riduci,
        ...(foto ? { immagine: foto.png, scala: foto.scala } : {}),
      });
    };

    /* Le mutazioni arrivano a raffica (React monta un foglio in decine di
       passi): si misura una volta per frame, non una volta per passo. */
    const richiedi = () => {
      if (inCoda || !vivo) return;
      inCoda = true;
      requestAnimationFrame(() => {
        inCoda = false;
        void sincronizza();
      });
    };

    /* Le mutazioni DENTRO il dock (la bolla che viaggia scrive left/width
       trenta volte al secondo) non dicono niente su chi lo copre: si
       ignorano, o ogni viaggio diventerebbe una raffica di chiamate al
       ponte nativo per non spostare niente. Il tasto acceso che cambia
       arriva per la via giusta: la `firma`. */
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
        vetroConfermato = true;
        pronto = true;
        /* Un dock nuovo che prende servizio annulla lo spegnimento del
           dock morto un attimo fa: e cosi che la lente VIAGGIA da una
           schermata all'altra invece di rinascere ferma. */
        if (spegnimentoInSospeso !== null) {
          window.clearTimeout(spegnimentoInSospeso);
          spegnimentoInSospeso = null;
        }
        void sincronizza();
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

    richiediRef.current = richiedi;

    return () => {
      vivo = false;
      richiediRef.current = () => {};
      oss.disconnect();
      window.removeEventListener("resize", richiedi);
      window.removeEventListener("orientationchange", richiedi);
      if (pronto) {
        /* Non subito: se e una navigazione, il prossimo dock arriva fra
           pochi millisecondi e cancella l'appuntamento (vedi
           spegnimentoInSospeso qui sopra). 120ms: piu del cambio pagina,
           meno di quanto serva a un occhio per notare un vetro rimasto
           acceso sul login. */
        if (spegnimentoInSospeso !== null) {
          window.clearTimeout(spegnimentoInSospeso);
        }
        spegnimentoInSospeso = window.setTimeout(() => {
          spegnimentoInSospeso = null;
          void vetro.nascondi();
        }, 120);
      }
      /* NIENTE setAttivo(false) qui: a smontaggio vero lo stato muore da
         solo, mentre nel doppio giro di effetti dello sviluppo (Strict
         Mode) questa pulizia spogliava un dock ancora VIVO per il tempo
         di un giro di ponte — ed era il banco dei fantasmi a morderla. */
    };
  }, [pillola]);

  /* Tasto acceso, tema o chiaro/scuro cambiati: nuova fotografia e lente
     sul tasto giusto. Un rAF di attesa, cosi la classe `.on` e i colori
     nuovi sono GIA nel DOM quando si scatta. Il primo giro non passa di
     qui: lo fa `disponibile()` qui sopra. */
  useEffect(() => {
    const id = requestAnimationFrame(() => richiediRef.current());
    return () => cancelAnimationFrame(id);
  }, [firma, tema, modo]);

  return attivo;
}
