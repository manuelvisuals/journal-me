"use client";

/**
 * IL POPUP DI CONFERMA, UNO PER TUTTO (13 settembre 2026, richiesta di
 * Manuel: "un template per il popup di conferma che useremo sempre lo
 * stesso"). Mockup: design/mockups/admin-iscritti.html, sezione 05.
 *
 * Come si usa, da qualunque schermata:
 *
 *   const ok = await conferma({
 *     titolo: "Passare a Gratis?",
 *     testo: <>Perde subito l'AI e il cloud. Si puo rimettere Premium.</>,
 *     azione: "Passa a Gratis",
 *   });
 *   if (!ok) return;
 *
 * Le regole del disegno, che valgono per chiunque lo chiami:
 *   - il titolo e una DOMANDA; il testo dice cosa succede e se si torna
 *     indietro; l'azione ha il suo nome vero ("Elimina", "Passa a Gratis"),
 *     mai "OK";
 *   - "Annulla" a sinistra, l'azione a destra; Esc, il velo e Annulla sono
 *     la stessa cosa (false);
 *   - `pericolo: true` fa il tasto rosso: solo quando distrugge;
 *   - `scrivi: "email@..."` chiede di riscrivere quella parola e tiene il
 *     tasto spento finche non torna: per cio che non si puo annullare.
 *
 * Il popup e uno store come il toast: la promessa vive qui, il layout
 * monta <ConfermaHost /> una volta sola, e nessuna schermata deve tenersi
 * uno stato "aperto/chiuso". Una seconda richiesta mentre una e aperta
 * risponde false a quella vecchia.
 */

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useT } from "@/lib/i18n";

export type ConfermaOpzioni = {
  titolo: string;
  testo?: ReactNode;
  /** Il nome dell'azione, sul tasto a destra. */
  azione: string;
  /** Tasto rosso: solo quando distrugge. */
  pericolo?: boolean;
  /** Se c'e, si deve riscrivere questa parola per accendere il tasto. */
  scrivi?: string;
  /** Il segnaposto del campo, quando `scrivi` c'e. */
  scriviAiuto?: string;
};

type Aperta = { id: number; opzioni: ConfermaOpzioni; risolvi: (ok: boolean) => void };

let corrente: Aperta | null = null;
let seq = 0;
const ascoltatori = new Set<() => void>();
function emetti() {
  for (const l of ascoltatori) l();
}

export function conferma(opzioni: ConfermaOpzioni): Promise<boolean> {
  if (corrente) corrente.risolvi(false);
  return new Promise<boolean>((risolvi) => {
    seq += 1;
    corrente = { id: seq, opzioni, risolvi };
    emetti();
  });
}

function chiudi(ok: boolean) {
  if (!corrente) return;
  const c = corrente;
  corrente = null;
  emetti();
  c.risolvi(ok);
}

function iscrivi(l: () => void) {
  ascoltatori.add(l);
  return () => {
    ascoltatori.delete(l);
  };
}

function normalizza(s: string): string {
  return s.trim().toLowerCase();
}

/** Montato UNA volta nel layout. */
export function ConfermaHost() {
  const aperta = useSyncExternalStore(iscrivi, () => corrente, () => null);
  if (!aperta) return null;
  // `key`: ogni richiesta e un popup nuovo, col campo vuoto, senza dover
  // azzerare uno stato dentro un effetto.
  return <Popup key={aperta.id} opzioni={aperta.opzioni} />;
}

function Popup({ opzioni: o }: { opzioni: ConfermaOpzioni }) {
  const t = useT();
  const [scritto, setScritto] = useState("");
  const primo = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") chiudi(false);
    };
    window.addEventListener("keydown", onKey);
    // Il fuoco parte da "Annulla": l'azione va scelta, non premuta per sbaglio.
    primo.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const bloccato = !!o.scrivi && normalizza(scritto) !== normalizza(o.scrivi);

  return (
    <div className="jm-conf-velo" onMouseDown={(e) => { if (e.target === e.currentTarget) chiudi(false); }}>
      <div className="jm-conf" role="alertdialog" aria-modal="true" aria-labelledby="jm-conf-titolo">
        <h2 id="jm-conf-titolo" className="jm-conf-titolo">{o.titolo}</h2>
        {o.testo ? <p className="jm-conf-testo">{o.testo}</p> : null}
        {o.scrivi ? (
          <input
            className="jm-conf-campo"
            type="text"
            autoComplete="off"
            spellCheck={false}
            value={scritto}
            placeholder={o.scriviAiuto ?? t("Scrivi qui per confermare")}
            aria-label={o.scriviAiuto ?? t("Scrivi qui per confermare")}
            onChange={(e) => setScritto(e.target.value)}
          />
        ) : null}
        <div className="jm-conf-tasti">
          <button ref={primo} type="button" className="jm-conf-annulla" onClick={() => chiudi(false)}>
            {t("Annulla")}
          </button>
          <button
            type="button"
            className={`jm-conf-azione${o.pericolo ? " pericolo" : ""}`}
            disabled={bloccato}
            onClick={() => chiudi(true)}
          >
            {o.azione}
          </button>
        </div>
      </div>
    </div>
  );
}
