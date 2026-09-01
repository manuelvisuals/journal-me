"use client";

/**
 * L'ATTESA DELL'ELABORAZIONE (2 settembre 2026, mockup
 * design/mockups/attesa-elaborazione.html, richiesta di Manuel: "questa
 * parte impiega fino a un minuto: spiega all'utente che puo richiedere
 * circa 1 minuto, con countdown").
 *
 * Prima: una rotella e una frase, per 30-60 secondi. Dopo venti secondi
 * una rotella muta sembra un'app rotta. Adesso tre cose, e nessuna mente:
 *
 *  - L'ANELLO e un orologio, non una barra di avanzamento: si svuota in
 *    ATTESA_PREVISTA secondi, cioe il tempo che DI SOLITO basta (misurato
 *    sul sito vero: 30-35 s sul computer, di piu sul telefono). Al centro
 *    i secondi che mancano. Quando arrivano a zero non si inventa niente:
 *    la riga sotto cambia frase ("ci vuole un po' piu del solito") e il
 *    punto del passo in corso continua a pulsare.
 *  - I TRE PASSI sono eventi VERI del codice, non tempi stimati: "leggo il
 *    racconto" finche l'analisi non e pronta (onAnalisi in
 *    save-recording.ts), "salvo la giornata" finche saveRecording non
 *    torna, "controllo cosa non e chiaro" finche i chiarimenti non
 *    rispondono. Il passo in corso e in --color-ink, quelli fatti
 *    arretrano, quelli a venire sono spenti.
 *  - La RIGA ONESTA in fondo: "di solito ci vuole meno di un minuto".
 *
 * E una superficie a schermo pieno: monta useRitiraDock come le altre
 * (CLAUDE.md del modulo, "il sipario del dock").
 */

import { useEffect, useState } from "react";
import { useRitiraDock } from "@/components/ui/dock-sipario";
import { useT } from "@/lib/i18n";

/** Il tempo che di solito basta, in secondi. Non e una promessa: e un orologio. */
export const ATTESA_PREVISTA = 45;

export type PassoElaborazione = "lettura" | "salvataggio" | "dubbi";

const PASSI: ReadonlyArray<readonly [PassoElaborazione, string]> = [
  ["lettura", "Leggo il racconto"],
  ["salvataggio", "Salvo la giornata"],
  ["dubbi", "Controllo cosa non e chiaro"],
];

/* L'anello: raggio 47 su un viewBox di 96, circonferenza 2*pi*47. */
const RAGGIO = 47;
const CIRCONFERENZA = 2 * Math.PI * RAGGIO;

export function AttesaElaborazione({ passo }: { passo: PassoElaborazione }) {
  const t = useT();
  useRitiraDock();

  const [rimasti, setRimasti] = useState<number>(ATTESA_PREVISTA);
  useEffect(() => {
    const partenza = Date.now();
    const id = window.setInterval(() => {
      const passati = Math.floor((Date.now() - partenza) / 1000);
      setRimasti(Math.max(0, ATTESA_PREVISTA - passati));
    }, 250);
    return () => window.clearInterval(id);
  }, []);

  const frazione = rimasti / ATTESA_PREVISTA;
  const indice = PASSI.findIndex(([chiave]) => chiave === passo);

  return (
    <div className="jm-attesa" role="status" aria-live="polite">
      <div className="jm-attesa-anello" aria-hidden="true">
        <svg viewBox="0 0 96 96">
          <circle className="jm-attesa-traccia" cx="48" cy="48" r={RAGGIO} />
          <circle
            className="jm-attesa-pieno"
            cx="48"
            cy="48"
            r={RAGGIO}
            style={{
              strokeDasharray: CIRCONFERENZA,
              strokeDashoffset: CIRCONFERENZA * (1 - frazione),
            }}
          />
        </svg>
        <div className="jm-attesa-secondi">
          <span>
            {rimasti}
            <small>s</small>
          </span>
        </div>
      </div>
      <div className="jm-attesa-kicker">{t("elaborazione")}</div>
      <ol className="jm-attesa-passi">
        {PASSI.map(([chiave, frase], i) => (
          <li
            key={chiave}
            className={
              i < indice
                ? "jm-attesa-passo jm-attesa-fatto"
                : i === indice
                  ? "jm-attesa-passo jm-attesa-ora"
                  : "jm-attesa-passo"
            }
            aria-current={i === indice ? "step" : undefined}
          >
            <span className="jm-attesa-punto" />
            {t(frase)}
          </li>
        ))}
      </ol>
      <div className="jm-attesa-nota">
        {rimasti > 0
          ? t("Di solito ci vuole meno di un minuto.")
          : t("Ci vuole un po' piu del solito. Ancora un momento.")}
      </div>
    </div>
  );
}
