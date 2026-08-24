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

  const chiudi = useCallback(() => {
    chiusoPerSempre.current = true;
    if (spuntato) {
      void (async () => {
        const id = await identita(mode);
        if (id) chiediSilenzio(id);
      })();
    }
    setAperto(false);
  }, [mode, spuntato]);

  if (!aperto) return null;

  return (
    <div className="jm-benv-sal" role="dialog" aria-modal="true">
      <div className="jm-benv-sal-box">
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
            {t("Non mostrare piu questo messaggio")}
          </label>
        )}
        <button type="button" className="jm-benv-sal-b" onClick={chiudi}>
          {t("Inizia")}
        </button>
      </div>
    </div>
  );
}
