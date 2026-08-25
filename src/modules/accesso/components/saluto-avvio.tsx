"use client";

/**
 * Il messaggio di benvenuto all'avvio.
 *
 * ATTENZIONE: qui c'e SOLO l'impianto. Il disegno (colori, animazioni,
 * immagine, posizione) si fa dopo, con Manuel: quello che si vede adesso e
 * un riquadro qualsiasi, apposta.
 *
 * Regole (dalla specifica del 24 agosto 2026):
 *  - una volta per APERTURA dell'app, non per montaggio e non per
 *    navigazione;
 *  - le prime due volte sono obbligatorie, la casella "non mostrare piu"
 *    compare dalla terza (APRI_CASELLA_DALLA);
 *  - il silenzio vale fino al logout, non per sempre;
 *  - logout e reinstallazione riportano alla prima visualizzazione;
 *  - chi non e dentro non lo vede.
 *
 * Due strade, perche il riquadro deve essere dipinto nello STESSO
 * fotogramma della schermata e non un attimo dopo:
 *  - la strada VELOCE (useLayoutEffect, prima del paint) non tocca la rete:
 *    legge solo se questo dispositivo ha chiesto silenzio. E' il caso
 *    normale. Puo permetterselo perche questo componente e montato dentro
 *    AuthGate: se e montato fuori dalle pagine pubbliche, un utente c'e
 *    gia per costruzione;
 *  - la strada LENTA (useEffect asincrono) risolve l'identita, butta un
 *    silenzio che appartiene a un login morto, e conta l'apertura.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { useStorageMode } from "@/lib/data/store";
import { SELETTORE_LINGUETTA } from "@/modules/accesso/components/linguetta";
import { useT } from "@/lib/i18n";
import {
  azzeraApertura,
  chiediSilenzio,
  contaApertura,
  giaMostratoInQuestaApertura,
  identita,
  segnaMostrato,
  silenzioScritto,
  silenzioVale,
} from "@/modules/accesso/saluto-stato";

// useLayoutEffect protesta in SSR: sul server non c'e paint da anticipare.
const useEffettoPrimaDelPaint =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

function paginaPubblica(pathname: string): boolean {
  return (
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/benvenuto") ||
    pathname.startsWith("/privacy") ||
    pathname.startsWith("/termini")
  );
}

// Il listener che spegne "gia mostrato" quando non c'e nessun utente. Sta
// a livello di modulo e non nel componente: il componente si smonta proprio
// quando serve (AuthGate smette di disegnare i figli appena la sessione
// cade), quindi un listener montato con lui non vedrebbe mai l'uscita.
let vedettaAccesa = false;
function accendiVedetta(): void {
  if (vedettaAccesa) return;
  vedettaAccesa = true;
  void import("@/lib/supabase/client").then(({ createClient }) => {
    createClient().auth.onAuthStateChange((_evento, sessione) => {
      if (!sessione) azzeraApertura();
    });
  });
}

export function SalutoAvvio() {
  const t = useT();
  const mode = useStorageMode();
  const pathname = usePathname();
  const pubblica = paginaPubblica(pathname);

  const [aperto, setAperto] = useState<boolean>(false);
  const [casella, setCasella] = useState<boolean>(false);
  const [spuntato, setSpuntato] = useState<boolean>(false);

  // E' QUESTO montaggio ad aver aperto il messaggio? Senza questa domanda
  // la strada lenta riconterebbe l'apertura a ogni rimontaggio.
  const apertoDaMe = useRef<boolean>(false);
  // Una risposta lenta non deve riaprire cio che l'utente ha gia chiuso.
  const chiusoPerSempre = useRef<boolean>(false);
  // Due tocchi rapidi farebbero partire due animazioni sovrapposte.
  const inChiusura = useRef<boolean>(false);
  const veloRef = useRef<HTMLDivElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const reteDiSicurezza = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (reteDiSicurezza.current !== null) {
        window.clearTimeout(reteDiSicurezza.current);
      }
    };
  }, []);

  /* ---------- strada veloce: prima del paint, zero rete ---------- */
  useEffettoPrimaDelPaint(() => {
    if (pubblica || mode === "resolving") return;
    if (chiusoPerSempre.current) return;
    if (giaMostratoInQuestaApertura()) return;
    // Se un silenzio esiste, si aspetta la strada lenta: potrebbe essere di
    // un login morto, e in quel caso il messaggio va aperto lo stesso.
    if (silenzioScritto()) return;
    segnaMostrato();
    apertoDaMe.current = true;
    setAperto(true);
  }, [pubblica, mode]);

  /* ---------- strada lenta: identita, silenzio, conteggio ---------- */
  useEffect(() => {
    if (pubblica || mode === "resolving") return;
    if (mode === "cloud") accendiVedetta();
    let vivo = true;
    void (async () => {
      const id = await identita(mode);
      if (!vivo || chiusoPerSempre.current) return;
      if (!id) {
        // Nessuno dentro: niente messaggio e niente da contare.
        setAperto(false);
        return;
      }
      if (silenzioVale(id)) {
        setAperto(false);
        return;
      }
      if (!apertoDaMe.current) {
        if (giaMostratoInQuestaApertura()) return;
        segnaMostrato();
        apertoDaMe.current = true;
        setAperto(true);
      }
      const { casella: mostraCasella } = contaApertura(id);
      if (!vivo || chiusoPerSempre.current) return;
      setCasella(mostraCasella);
    })();
    return () => {
      vivo = false;
    };
  }, [pubblica, mode]);

  /**
   * La chiusura: il messaggio si risucchia dentro la linguetta.
   *
   * Si misurano dal vivo i due rettangoli, si calcola lo scarto fra i
   * centri e il rapporto fra le dimensioni, e si anima il messaggio verso
   * la linguetta. Due scelte che sembrano dettagli e non lo sono:
   *
   * - Web Animations API, non una transizione CSS. Impostare transizione e
   *   nuovo transform nello stesso giro di JS parte "a volte": a meta corsa
   *   lo stile calcolato risulta ancora identita. animate() parte sempre.
   * - Si anima il MESSAGGIO, e del velo solo fondo e sfocatura. Il velo e
   *   il genitore: animarne l'opacita porterebbe via anche il figlio, e il
   *   messaggio viaggerebbe gia fantasma. Il viaggio deve vedersi, quindi
   *   l'opacita del riquadro resta quasi piena fino all'ultimo fotogramma.
   */
  const chiudi = useCallback(() => {
    if (inChiusura.current) return;
    inChiusura.current = true;
    chiusoPerSempre.current = true;
    if (spuntato) {
      void (async () => {
        const id = await identita(mode);
        if (id) chiediSilenzio(id);
      })();
    }

    const box = boxRef.current;
    const velo = veloRef.current;
    const ling = document.querySelector<HTMLElement>(SELETTORE_LINGUETTA);
    // Ripieghi obbligatori: senza linguetta, o senza animate(), chiusura
    // secca. Mai un crash, mai un messaggio che resta aperto.
    if (!box || !ling || typeof box.animate !== "function") {
      setAperto(false);
      return;
    }

    const b = box.getBoundingClientRect();
    const l = ling.getBoundingClientRect();
    const dx = l.left + l.width / 2 - (b.left + b.width / 2);
    const dy = l.top + l.height / 2 - (b.top + b.height / 2);
    // Pavimento sulla scala: senza, un riquadro molto piu grande della
    // linguetta collassa a zero e sparisce prima di arrivare.
    const fine = Math.max(Math.min(l.width / b.width, l.height / b.height), 0.04);
    const versoFine = (q: number) => 1 + (fine - 1) * q;
    // Lo sbilanciamento fra X e Y durante il viaggio e cio che da la
    // sensazione del risucchio: una scala uniforme sembra solo un
    // rimpicciolimento.
    const s55 = versoFine(0.55);
    const s82 = versoFine(0.82);

    box.animate(
      [
        {
          transform: "translate(0px, 0px) scale(1, 1)",
          borderRadius: "30px",
          opacity: 1,
        },
        {
          transform: `translate(${dx * 0.55}px, ${dy * 0.55}px) scale(${s55 * 1.12}, ${s55 * 0.84})`,
          borderRadius: "40px",
          opacity: 1,
        },
        {
          transform: `translate(${dx * 0.82}px, ${dy * 0.82}px) scale(${s82 * 0.74}, ${s82 * 1.24})`,
          borderRadius: "50px",
          opacity: 0.98,
        },
        {
          transform: `translate(${dx}px, ${dy}px) scale(${fine}, ${fine})`,
          borderRadius: "60px",
          opacity: 0.25,
        },
      ],
      { duration: 480, easing: "cubic-bezier(.55,0,.72,.3)", fill: "forwards" },
    );

    if (velo && typeof velo.animate === "function") {
      const fondo = getComputedStyle(velo).backgroundColor;
      velo.animate(
        [
          {
            backgroundColor: fondo,
            WebkitBackdropFilter: "blur(14px)",
            backdropFilter: "blur(14px)",
          },
          {
            backgroundColor: "rgba(0, 0, 0, 0)",
            WebkitBackdropFilter: "blur(0px)",
            backdropFilter: "blur(0px)",
          },
        ],
        { duration: 440, easing: "ease-out", fill: "forwards" },
      );
    }

    // Il ricevimento: la linguetta fa un battito quando il messaggio
    // arriva. Il translateY(-50%) va ripetuto in OGNI fotogramma, o al
    // primo la linguetta salta di posto.
    if (typeof ling.animate === "function") {
      ling.animate(
        [
          { transform: "translateY(-50%) scale(1)" },
          { transform: "translateY(-50%) scale(1.22)" },
          { transform: "translateY(-50%) scale(1)" },
        ],
        { duration: 300, delay: 400, easing: "ease-out" },
      );
    }

    // Cintura: onfinish non arriva se la scheda finisce in secondo piano.
    reteDiSicurezza.current = window.setTimeout(() => setAperto(false), 900);
  }, [mode, spuntato]);

  if (!aperto) return null;

  return (
    <div className="jm-benv-sal" role="dialog" aria-modal="true" ref={veloRef}>
      <div className="jm-benv-sal-box" ref={boxRef}>
        <div className="jm-benv-sal-h">{t("Bentornato")}</div>
        <div className="jm-benv-sal-p">
          {t("Questo e il posto del messaggio di benvenuto.")}
        </div>
        {casella && (
          <label className="jm-benv-sal-c">
            <input
              type="checkbox"
              checked={spuntato}
              onChange={(e) => setSpuntato(e.target.checked)}
            />
            {t("Non mostrare piu (fino al prossimo accesso)")}
          </label>
        )}
        <button type="button" className="jm-benv-sal-b" onClick={chiudi}>
          {t("Inizia")}
        </button>
      </div>
    </div>
  );
}
