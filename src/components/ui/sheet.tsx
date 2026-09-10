"use client";

import { createPortal } from "react-dom";
import { useEffect, useSyncExternalStore } from "react";
import { useRitiraDock } from "@/components/ui/dock-sipario";

/**
 * Quanti fogli sono aperti adesso. Il blocco dello scorrimento si mette al
 * primo e si toglie all'ultimo: due fogli sovrapposti non devono sbloccare
 * la pagina quando si chiude quello sopra.
 */
let apertiOra = 0;

/**
 * Il foglio dal basso — la primitiva di scheletro.
 *
 * Non e nato qui: e il foglio di "Aggiungi a questa giornata" (modulo
 * Oggi, add-to-day.tsx), promosso a scheletro il 28 agosto 2026 per la
 * porta dell'account (mockup porta-account §03, tranello 2). Il CSS
 * jm-sheet-* vive in src/styles/base.css, spostato verbatim: velo
 * sfocato, maniglia, righe da 58px, max-width 440px, padding per la
 * safe-area dell'iPhone. Chi ha bisogno di un foglio passa DA QUI: un
 * secondo foglio disegnato da capo e esattamente il difetto che questa
 * primitiva esiste per impedire.
 *
 * DAL 1 SETTEMBRE 2026 IL FOGLIO NASCE IN UN PORTAL SU BODY. Prima
 * nasceva dove lo montava il cliente, e il cliente sbagliato bastava a
 * romperlo: il pallino dell'account sta dentro la barra in alto, che e
 * sticky con z-index 6 — un contesto di stacking — quindi lo z-index 60
 * del velo valeva SOLO li dentro e il dock di vetro (z 20, fuori dalla
 * barra) passava sopra alle righe del menu, che non si potevano piu
 * toccare (screenshot di Manuel). Sul body il velo copre davvero tutto,
 * dock compreso: cosi anche la lastra nativa lo vede coperto
 * (dockCoperto in dock-vetro.ts) e si spegne da sola.
 *
 * L'API e volutamente piccola: il velo che chiude al tocco, il foglio
 * che ferma il click, la maniglia. Le righe dentro sono contenuto dei
 * clienti (classi jm-sheet-row / -ic / -txt / -t / -d, anche loro in
 * base.css). Esc lo gestisce il cliente se gli serve: un foglio da
 * telefono si chiude col pollice, non con la tastiera.
 */

function subscribeNoop(): () => void {
  return () => {};
}

export function Sheet({
  label,
  onClose,
  children,
}: {
  /** L'aria-label del dialogo: cosa E questo foglio. */
  label: string;
  /** Chiamata dal tocco sul velo. */
  onClose: () => void;
  children: React.ReactNode;
}) {
  /* Col foglio aperto il dock non esiste (dock-sipario.ts): il velo lo
     coprirebbe solo sul web — nel guscio iOS la lastra nativa sta sopra
     la WebView e resterebbe accesa sopra le righe del menu. */
  useRitiraDock();
  /* LA PAGINA DIETRO NON SCORRE (Manuel, 10 settembre 2026). Il foglio delle
     ruote e alto cinque righe e largo meno del foglio: il dito che passava
     accanto alla ruota non trovava niente da scorrere, il gesto saliva alla
     pagina e sotto il velo scorreva il diario. Un foglio modale blocca lo
     sfondo, punto: si blocca l'html (la pagina scorre li, non in un div) e
     si riapre esattamente dov'era. */
  useEffect(() => {
    const el = document.documentElement;
    if (apertiOra === 0) {
      el.dataset.jmSheetTop = String(window.scrollY);
      el.style.overflow = "hidden";
    }
    apertiOra += 1;
    return () => {
      apertiOra -= 1;
      if (apertiOra > 0) return;
      el.style.overflow = "";
      const y = Number(el.dataset.jmSheetTop ?? "0");
      delete el.dataset.jmSheetTop;
      if (Number.isFinite(y)) window.scrollTo(0, y);
    };
  }, []);
  /* Mount flag senza setState-in-effect: stesso pattern di AppBarAzione.
     Il foglio si apre solo su un gesto, quindi in pratica e sempre gia
     montato; il flag serve solo a non toccare document sul server. */
  const mounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
  if (!mounted) return null;
  return createPortal(
    <div
      className="jm-sheet-scrim"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={onClose}
    >
      <div className="jm-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="jm-sheet-grip" aria-hidden="true" />
        {children}
      </div>
    </div>,
    document.body,
  );
}
